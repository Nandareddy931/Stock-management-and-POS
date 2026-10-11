import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/config";

export interface ProductData {
    name: string;
    category: string;
    manufacturer?: string;
    unit: string;
    sellingPrice: number;
    minimumStock: number;
    currentStock: number;
    active: boolean;
}

export interface Product extends ProductData {
    id: string;
}


/**
 * Check if a product with a similar name already exists.
 * Used to avoid creating duplicates during invoice scan.
 */
export const findProductByName = async (
    name: string
): Promise<Product | null> => {
    const snapshot = await getDocs(productsCollection);
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const doc of snapshot.docs) {
        const data = doc.data() as ProductData;
        const existing = data.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (existing === normalized) {
            return { id: doc.id, ...data };
        }
    }
    return null;
};

const productsCollection = collection(db, "products");

/**
 * Get all products from Firestore.
 */
export const getProducts = async (): Promise<Product[]> => {
    const snapshot = await getDocs(productsCollection);

    return snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...(productDoc.data() as ProductData),
    }));
};

/**
 * Add a new product.
 */
export const addProduct = async (
    product: Omit<ProductData, "currentStock" | "active">
): Promise<string> => {
    const productData: ProductData = {
        ...product,
        currentStock: 0,
        active: true,
    };

    const productRef = await addDoc(productsCollection, {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    return productRef.id;
};

/**
 * Update an existing product.
 */
export const updateProduct = async (
    productId: string,
    updates: Partial<Omit<ProductData, "currentStock">>
): Promise<void> => {
    const productRef = doc(db, "products", productId);

    await updateDoc(productRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
};

/**
 * Deactivate a product instead of deleting it.
 */
export const deactivateProduct = async (
    productId: string
): Promise<void> => {
    const productRef = doc(db, "products", productId);

    await updateDoc(productRef, {
        active: false,
        updatedAt: serverTimestamp(),
    });
};

/**
 * Reactivate a previously deactivated product.
 */
export const reactivateProduct = async (
    productId: string
): Promise<void> => {
    const productRef = doc(db, "products", productId);

    await updateDoc(productRef, {
        active: true,
        updatedAt: serverTimestamp(),
    });
};
export const deleteProduct = async (productId: string): Promise<void> => {
    const productRef = doc(db, "products", productId);
    await deleteDoc(productRef);
};