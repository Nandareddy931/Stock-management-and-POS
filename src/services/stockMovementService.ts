import {
    addDoc,
    collection,
    serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/config";

export type StockMovementType = "IN" | "OUT";

export type StockReferenceType =
    | "STOCK_IN"
    | "BILL"
    | "ADJUSTMENT";

export interface StockMovementData {
    productId: string;
    productName: string;
    type: StockMovementType;
    quantity: number;
    referenceType: StockReferenceType;
    referenceId: string;
    referenceNumber?: string;
    createdAt?: unknown;
}

const stockMovementsCollection = collection(
    db,
    "stockMovements"
);

/**
 * Record a stock movement.
 *
 * IN  = stock added to inventory
 * OUT = stock removed from inventory
 */
export const createStockMovement = async (
    movement: Omit<StockMovementData, "createdAt">
): Promise<string> => {
    if (!movement.productId) {
        throw new Error("Product ID is required.");
    }

    if (!movement.productName.trim()) {
        throw new Error("Product name is required.");
    }

    if (movement.quantity <= 0) {
        throw new Error("Stock movement quantity must be greater than zero.");
    }

    if (!movement.referenceId) {
        throw new Error("Reference ID is required.");
    }

    const movementRef = await addDoc(
        stockMovementsCollection,
        {
            ...movement,
            createdAt: serverTimestamp(),
        }
    );

    return movementRef.id;
};