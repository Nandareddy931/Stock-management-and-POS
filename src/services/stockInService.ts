
import {
    collection,
    doc,
    getDoc,
    increment,
    serverTimestamp,
    writeBatch,
    type WriteBatch,
} from "firebase/firestore";

import { db } from "../firebase/config";

export interface StockInItem {
    productId: string;
    product: string;
    batch: string;
    manufacturingDate?: string;
    expiryDate?: string;
    pack?: string;
    quantity: number;
    rate: number;
}

export interface StockInDetails {
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    billMode: string;
    deliveryDate?: string;
    transport?: string;
    notes?: string;
}

export interface SaveStockInResult {
    stockInId: string;
}

const calculateItemAmount = (item: StockInItem): number => {
    return item.quantity * item.rate;
};

const validateStockIn = (
    supplierDetails: StockInDetails,
    items: StockInItem[]
): void => {
    if (!supplierDetails.supplier.trim()) {
        throw new Error("Please enter supplier / dealer name.");
    }

    if (!supplierDetails.invoiceNumber.trim()) {
        throw new Error("Please enter invoice number.");
    }

    if (!supplierDetails.invoiceDate) {
        throw new Error("Please select invoice date.");
    }

    if (items.length === 0) {
        throw new Error("Please add at least one product.");
    }

    for (const item of items) {
        if (!item.productId.trim()) {
            throw new Error("Every stock item must have a valid product.");
        }

        if (!item.product.trim()) {
            throw new Error("Every stock item must have a product name.");
        }

        if (!item.batch.trim()) {
            throw new Error(
                `Please enter batch number for ${item.product}.`
            );
        }

        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            throw new Error(
                `Quantity must be greater than 0 for ${item.product}.`
            );
        }

        if (!Number.isFinite(item.rate) || item.rate <= 0) {
            throw new Error(
                `Rate must be greater than 0 for ${item.product}.`
            );
        }
    }
};

export const saveStockIn = async (
    supplierDetails: StockInDetails,
    items: StockInItem[]
): Promise<SaveStockInResult> => {
    validateStockIn(supplierDetails, items);

    const batch: WriteBatch = writeBatch(db);

    const stockInRef = doc(collection(db, "stockIns"));

    const subtotal = items.reduce(
        (total, item) => total + calculateItemAmount(item),
        0
    );

    /*
     * ---------------------------------------------------------
     * 1. STOCK IN DOCUMENT
     * ---------------------------------------------------------
     */

    batch.set(stockInRef, {
        supplier: supplierDetails.supplier.trim(),
        invoiceNumber: supplierDetails.invoiceNumber.trim(),
        invoiceDate: supplierDetails.invoiceDate,
        billMode: supplierDetails.billMode,
        deliveryDate: supplierDetails.deliveryDate ?? "",
        transport: supplierDetails.transport?.trim() ?? "",
        notes: supplierDetails.notes?.trim() ?? "",

        items: items.map((item) => ({
            productId: item.productId,
            product: item.product.trim(),
            batch: item.batch.trim(),
            manufacturingDate: item.manufacturingDate ?? "",
            expiryDate: item.expiryDate ?? "",
            pack: item.pack?.trim() ?? "",
            quantity: item.quantity,
            rate: item.rate,
            amount: calculateItemAmount(item),
        })),

        subtotal,
        grandTotal: subtotal,
        createdAt: serverTimestamp(),
    });

    /*
     * ---------------------------------------------------------
     * 2. PROCESS EACH STOCK ITEM
     * ---------------------------------------------------------
     */

    for (const item of items) {
        const productRef = doc(db, "products", item.productId);

        /*
         * Verify that the product still exists before committing.
         *
         * This protects us from a stale product ID if a product was
         * changed/deactivated after the invoice was scanned.
         */
        const productSnapshot = await getDoc(productRef);

        if (!productSnapshot.exists()) {
            throw new Error(
                `Product "${item.product}" no longer exists.`
            );
        }

        /*
         * -----------------------------------------------------
         * A. STOCK MOVEMENT
         * -----------------------------------------------------
         */

        const movementRef = doc(
            collection(db, "stockMovements")
        );

        batch.set(movementRef, {
            stockInId: stockInRef.id,
            product: item.product.trim(),
            productId: item.productId,
            batch: item.batch.trim(),
            pack: item.pack?.trim() ?? "",
            type: "STOCK_IN",
            quantity: item.quantity,
            rate: item.rate,
            amount: calculateItemAmount(item),
            invoiceNumber:
                supplierDetails.invoiceNumber.trim(),
            supplier:
                supplierDetails.supplier.trim(),
            movementDate:
                supplierDetails.invoiceDate,
            createdAt: serverTimestamp(),
        });

        /*
         * -----------------------------------------------------
         * B. PRODUCT BATCH
         * -----------------------------------------------------
         */

        const normalizedBatch = item.batch
            .trim()
            .replace(/\s+/g, "_");

        const batchId =
            `${item.productId}_${normalizedBatch}`;

        const batchRef = doc(
            db,
            "productBatches",
            batchId
        );

        const existingBatch = await getDoc(batchRef);

        if (existingBatch.exists()) {
            batch.update(batchRef, {
                quantityReceived: increment(item.quantity),
                currentQuantity: increment(item.quantity),
                purchaseRate: item.rate,
                supplier:
                    supplierDetails.supplier.trim(),
                invoiceNumber:
                    supplierDetails.invoiceNumber.trim(),
                updatedAt: serverTimestamp(),
            });
        } else {
            batch.set(batchRef, {
                productId: item.productId,
                productName: item.product.trim(),
                batchNumber: item.batch.trim(),

                manufacturingDate:
                    item.manufacturingDate ?? "",

                expiryDate:
                    item.expiryDate ?? "",

                pack: item.pack?.trim() ?? "",

                quantityReceived: item.quantity,
                currentQuantity: item.quantity,

                purchaseRate: item.rate,

                supplier:
                    supplierDetails.supplier.trim(),

                invoiceNumber:
                    supplierDetails.invoiceNumber.trim(),

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }

        /*
         * -----------------------------------------------------
         * C. TOTAL PRODUCT STOCK
         * -----------------------------------------------------
         */

        console.log("========== STOCK UPDATE ==========");
        console.log("Product:", item.product);
        console.log("Product ID:", item.productId);
        console.log(
            "Quantity being added:",
            item.quantity
        );
        console.log(
            "Firebase path:",
            `products/${item.productId}`
        );

        batch.update(productRef, {
            currentStock: increment(item.quantity),
            updatedAt: serverTimestamp(),
        });
    }

    /*
     * ---------------------------------------------------------
     * 3. COMMIT EVERYTHING AT ONCE
     * ---------------------------------------------------------
     */

    await batch.commit();

    console.log(
        "Stock saved successfully:",
        stockInRef.id
    );

    return {
        stockInId: stockInRef.id,
    };
};

