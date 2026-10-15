import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    type User,
} from "firebase/auth";
import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

export interface ShopUser {
    uid: string;
    email: string;
    displayName: string;
    shopId: string;
    role: "owner";
    createdAt: Date;
}

/**
 * Sign up a new user + create their shop.
 * shopId is the user's UID (simple, unique, easy).
 */
export const signupUser = async (
    email: string,
    password: string,
    shopName: string
): Promise<ShopUser> => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Update display name to shop name
    await updateProfile(cred.user, { displayName: shopName });

    // Create user doc + shop settings
    const shopId = uid; // Use UID as shopId for simplicity

    await setDoc(doc(db, "users", uid), {
        uid,
        email,
        displayName: shopName,
        shopId,
        role: "owner",
        createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "shops", shopId), {
        shopId,
        ownerUid: uid,
        name: shopName,
        createdAt: serverTimestamp(),
    });

    return {
        uid,
        email,
        displayName: shopName,
        shopId,
        role: "owner",
        createdAt: new Date(),
    };
};

/**
 * Login existing user.
 */
export const loginUser = async (
    email: string,
    password: string
): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
};

/**
 * Logout current user.
 */
export const logoutUser = async (): Promise<void> => {
    await signOut(auth);
};

/**
 * Send password reset email.
 */
export const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
};

/**
 * Load the ShopUser profile from Firestore.
 */
export const loadShopUser = async (user: User): Promise<ShopUser | null> => {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        shopId: data.shopId,
        role: data.role ?? "owner",
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
    };
};