
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase/config";
import { loadShopUser, type ShopUser } from "../services/authService";

interface AuthContextValue {
    user: User | null;
    shopUser: ShopUser | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [shopUser, setShopUser] = useState<ShopUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const unsubscribe = onAuthStateChanged(
            auth,
            async (firebaseUser) => {
                if (!active) return;

                setUser(firebaseUser);
                setLoading(true);

                try {
                    const profile = firebaseUser
                        ? await loadShopUser(firebaseUser)
                        : null;

                    if (active) {
                        setShopUser(profile);
                    }
                } catch (error) {
                    console.error("Failed to load shop user:", error);

                    if (active) {
                        setShopUser(null);
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
            },
            (error) => {
                console.error("Firebase auth state error:", error);

                if (active) {
                    setUser(null);
                    setShopUser(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, shopUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
}
