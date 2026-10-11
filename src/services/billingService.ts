import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";

import { db } from "../firebase/config";

export interface BillItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    sellingPrice: number;
    amount: number;
}

export type PaymentStatus = "Paid" | "Partial" | "Credit";

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
}

export interface Bill extends BillData {
    id: string;
    createdAt?: unknown;
}

const billsCollection = collection(db, "bills");

/**
 * Generate a professional bill number.
 *
 * Example:
 * BRD-2026-482731
 *
 * The timestamp component makes the number highly unlikely
 * to collide when bills are created offline on multiple devices.
 */
export const generateBillNumber = (): string => {
    const year = new Date().getFullYear();

    const timestampPart = Date.now().toString().slice(-6);

    return `BRD-${year}-${timestampPart}`;
};

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

/**
 * Check whether a bill number already exists.
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

/**
 * Save a bill to Firestore.
 */
export const saveBill = async (
    bill: BillData
): Promise<string> => {
    const errors = validateBill(bill);

    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }

    const billNumberExists = await isBillNumberExists(
        bill.billNumber
    );

    if (billNumberExists) {
        throw new Error(
            `Bill number ${bill.billNumber} already exists. Please generate a new bill number.`
        );
    }

    const billRef = await addDoc(billsCollection, {
        ...bill,
        createdAt: serverTimestamp(),
    });

    return billRef.id;
};

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