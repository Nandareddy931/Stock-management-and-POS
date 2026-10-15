import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
    increment,
} from "firebase/firestore";

import { db } from "../firebase/config";

// ============================================================
// TYPES
// ============================================================

export interface BillItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    sellingPrice: number;
    amount: number;
}

export type PaymentStatus = "Paid" | "Partial" | "Credit";
export type PaymentMode = "Cash" | "UPI" | "Card" | "Other";

export interface BillData {
    billNumber: string;
    customerName: string;
    customerPhone: string;
    billDate: string;
    items: BillItem[];
    subtotal: number;
    grandTotal: number;
    paidAmount: number;
    paymentStatus: PaymentStatus;
    paymentMode?: PaymentMode;
}

export interface Bill extends BillData {
    id: string;
    createdAt?: unknown;
}

// ============================================================
// COLLECTION REFERENCE
// ============================================================

const billsCollection = collection(db, "bills");

// ============================================================
// BILL NUMBER
// ============================================================

/**
 * Generate a professional bill number.
 *
 * Example: BRD-2026-482731
 *
 * The timestamp component makes the number highly unlikely
 * to collide when bills are created offline on multiple devices.
 */
export const generateBillNumber = (): string => {
    const year = new Date().getFullYear();
    const timestampPart = Date.now().toString().slice(-6);
    return `BRD-${year}-${timestampPart}`;
};

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate bill data before saving.
 */
export const validateBill = (bill: BillData): string[] => {
    const errors: string[] = [];

    if (!bill.billNumber.trim()) {
        errors.push("Bill number is required.");
    }

    if (!bill.customerName.trim()) {
        errors.push("Customer name is required.");
    }

    if (!bill.customerPhone.trim()) {
        errors.push("Customer phone number is required.");
    }

    if (!bill.billDate) {
        errors.push("Bill date is required.");
    }

    if (!bill.items || bill.items.length === 0) {
        errors.push("At least one product is required.");
    }

    if (bill.subtotal < 0) {
        errors.push("Subtotal cannot be negative.");
    }

    if (bill.grandTotal < 0) {
        errors.push("Grand total cannot be negative.");
    }

    if (bill.paidAmount < 0) {
        errors.push("Paid amount cannot be negative.");
    }

    if (bill.paidAmount > bill.grandTotal) {
        errors.push("Paid amount cannot be greater than grand total.");
    }

    for (const item of bill.items) {
        if (!item.productId) {
            errors.push("Every item must have a product.");
        }

        if (item.quantity <= 0) {
            errors.push(`Invalid quantity for ${item.productName}.`);
        }

        if (item.sellingPrice < 0) {
            errors.push(`Invalid selling price for ${item.productName}.`);
        }

        if (item.amount < 0) {
            errors.push(`Invalid amount for ${item.productName}.`);
        }
    }

    return errors;
};

// ============================================================
// DUPLICATE CHECK (ONLINE ONLY)
// ============================================================

/**
 * Check whether a bill number already exists.
 *
 * NOTE: This requires an online connection. Callers should
 * only invoke this when navigator.onLine === true.
 */
export const isBillNumberExists = async (
    billNumber: string
): Promise<boolean> => {
    const billsQuery = query(
        billsCollection,
        where("billNumber", "==", billNumber.trim())
    );

    const snapshot = await getDocs(billsQuery);

    return !snapshot.empty;
};

// ============================================================
// SAVE BILL — OFFLINE-SAFE
// ============================================================

/**
 * Save a bill + decrement stock — offline-safe.
 *
 * Uses a single writeBatch so:
 * - Works offline (all writes are queued locally)
 * - Atomic — either all writes succeed or none do
 * - No server round-trip needed to show success
 */
export const saveBill = async (bill: BillData): Promise<string> => {
    const errors = validateBill(bill);
    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }

    // Duplicate check ONLY when online (queries don't work offline)
    if (navigator.onLine) {
        try {
            const exists = await isBillNumberExists(bill.billNumber);
            if (exists) {
                throw new Error(
                    `Bill number ${bill.billNumber} already exists. Please generate a new bill number.`
                );
            }
        } catch (err) {
            // If the check itself fails (e.g., network dropped mid-check),
            // fall through and continue saving — timestamp-based bill numbers
            // make duplicates practically impossible.
            if (
                err instanceof Error &&
                err.message.includes("already exists")
            ) {
                throw err;
            }
            console.warn("Duplicate check skipped:", err);
        }
    }

    const batch = writeBatch(db);

    // 1. Create bill document with a client-side ID (works offline)
    const billRef = doc(collection(db, "bills"));
    const billId = billRef.id;

    batch.set(billRef, {
        ...bill,
        id: billId,
        createdAt: serverTimestamp(),
    });

    // 2. Queue stock decrements + movement logs
    for (const item of bill.items) {
        // Decrement product stock
        const productRef = doc(db, "products", item.productId);
        batch.update(productRef, {
            currentStock: increment(-item.quantity),
            updatedAt: serverTimestamp(),
        });

        // Log the stock movement (audit trail)
        const movementRef = doc(collection(db, "stockMovements"));
        batch.set(movementRef, {
            productId: item.productId,
            product: item.productName,
            type: "SALE",
            quantity: -item.quantity,
            unit: item.unit,
            rate: item.sellingPrice,
            amount: item.amount,
            billId,
            billNumber: bill.billNumber,
            customerName: bill.customerName,
            customerPhone: bill.customerPhone,
            movementDate: bill.billDate,
            createdAt: serverTimestamp(),
        });
    }

    // 3. Commit — resolves IMMEDIATELY when offline
    await batch.commit();

    return billId;
};

// ============================================================
// READ HELPERS
// ============================================================

/**
 * Get a single bill by Firestore document ID.
 */
export const getBillById = async (
    billId: string
): Promise<Bill | null> => {
    const billRef = doc(db, "bills", billId);
    const snapshot = await getDoc(billRef);

    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data();

    return {
        id: snapshot.id,
        ...(data as BillData),
        createdAt: data.createdAt,
    };
};

/**
 * Get all bills, newest first.
 */
export const getBills = async (): Promise<Bill[]> => {
    const billsQuery = query(
        billsCollection,
        orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(billsQuery);

    return snapshot.docs.map((billDoc) => {
        const data = billDoc.data();
        return {
            id: billDoc.id,
            ...(data as BillData),
            createdAt: data.createdAt,
        };
    });
};

/**
 * Search bills by exact customer phone number.
 */
export const searchBillsByCustomerPhone = async (
    phone: string
): Promise<Bill[]> => {
    const billsQuery = query(
        billsCollection,
        where("customerPhone", "==", phone.trim())
    );

    const snapshot = await getDocs(billsQuery);

    return snapshot.docs.map((billDoc) => {
        const data = billDoc.data();
        return {
            id: billDoc.id,
            ...(data as BillData),
            createdAt: data.createdAt,
        };
    });
};