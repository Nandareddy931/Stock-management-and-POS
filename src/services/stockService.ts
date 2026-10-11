import {
    doc,
    runTransaction,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/config";

const productsCollectionName = "products";
const stockMovementsCollectionName = "stockMovements";

/**
 * Deduct stock for a saved bill.
 *
 * The bill ID is used as the unique reference so that
 * the same bill cannot accidentally deduct stock twice.
 */
export const deductStockForBill = async (
    billId: string,
    billNumber: string,
    items: {
        productId: string;
        productName: string;
        quantity: number;
    }[]
): Promise<void> => {
    if (!billId) {
        throw new Error("Bill ID is required.");
    }

    if (!billNumber) {
        throw new Error("Bill number is required.");
    }

    if (!items.length) {
        throw new Error("Bill contains no products.");
    }

    await runTransaction(db, async (transaction) => {
        const productSnapshots = [];

        for (const item of items) {
            if (!item.productId) {
                throw new Error(
                    `Product ID missing for ${item.productName}.`
                );
            }

            if (item.quantity <= 0) {
                throw new Error(
                    `Invalid quantity for ${item.productName}.`
                );
            }

            const productRef = doc(
                db,
                productsCollectionName,
                item.productId
            );

            const productSnapshot = await transaction.get(productRef);

            if (!productSnapshot.exists()) {
                throw new Error(
                    `Product "${item.productName}" no longer exists.`
                );
            }

            productSnapshots.push({
                item,
                ref: productRef,
                snapshot: productSnapshot,
            });
        }

        /*
         * Check whether this bill has already created
         * stock-out movements.
         */
        for (const item of items) {
            const movementRef = doc(
                db,
                stockMovementsCollectionName,
                `${billId}_${item.productId}`
            );

            const movementSnapshot =
                await transaction.get(movementRef);

            if (movementSnapshot.exists()) {
                throw new Error(
                    `Stock for bill ${billNumber} has already been processed.`
                );
            }
        }

        /*
         * Validate all stock before changing anything.
         */
        for (const { item, snapshot } of productSnapshots) {
            const data = snapshot.data();

            const currentStock =
                typeof data.currentStock === "number"
                    ? data.currentStock
                    : 0;

            if (item.quantity > currentStock) {
                throw new Error(
                    `Insufficient stock for ${item.productName}. Available: ${currentStock}, requested: ${item.quantity}.`
                );
            }
        }

        /*
         * All products are valid and have sufficient stock.
         * Now perform the stock updates and create movements.
         */
        for (const { item, ref, snapshot } of productSnapshots) {
            const data = snapshot.data();

            const currentStock =
                typeof data.currentStock === "number"
                    ? data.currentStock
                    : 0;

            const newStock = currentStock - item.quantity;

            transaction.update(ref, {
                currentStock: newStock,
            });

            const movementRef = doc(
                db,
                stockMovementsCollectionName,
                `${billId}_${item.productId}`
            );

            transaction.set(movementRef, {
                productId: item.productId,
                productName: item.productName,
                type: "OUT",
                quantity: item.quantity,
                referenceType: "BILL",
                referenceId: billId,
                referenceNumber: billNumber,
                createdAt: serverTimestamp(),
            });
        }
    });
};