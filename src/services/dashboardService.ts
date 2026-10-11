import {
    collection,
    getDocs,
} from "firebase/firestore";

import { db } from "../firebase/config";

export interface DashboardProduct {
    id: string;
    name: string;
    currentStock: number;
    minimumStock: number;
    active?: boolean;
}

export interface DashboardBill {
    id: string;
    billNumber?: string;
    billDate?: string;
    grandTotal: number;
    paidAmount: number;
    paymentStatus?: string;
    customerName?: string;
}

export interface DashboardStockIn {
    id: string;
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    items: {
        product: string;
        quantity: number;
    }[];
}

export interface SalesChartData {
    date: string;
    amount: number;
}

export interface DashboardData {
    totalProducts: number;
    totalStock: number;
    todaySales: number;
    todayBills: number;
    outstanding: number;

    lowStockProducts: DashboardProduct[];

    recentStockIn: DashboardStockIn[];

    salesChart: SalesChartData[];
}

function toNumber(value: unknown): number {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
}

function getDateString(value: unknown): string {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value.slice(0, 10);
    }

    if (
        typeof value === "object" &&
        value !== null &&
        "toDate" in value &&
        typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
        return (
            (value as { toDate: () => Date })
                .toDate()
                .toISOString()
                .slice(0, 10)
        );
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return "";
}

export async function getDashboardData(): Promise<DashboardData> {
    const [productsSnapshot, billsSnapshot, stockInsSnapshot] =
        await Promise.all([
            getDocs(collection(db, "products")),
            getDocs(collection(db, "bills")),
            getDocs(collection(db, "stockIns")),
        ]);

    // -----------------------------
    // PRODUCTS
    // -----------------------------

    const products: DashboardProduct[] = productsSnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
            id: doc.id,
            name: String(data.name ?? "Unknown Product"),
            currentStock: toNumber(data.currentStock),
            minimumStock: toNumber(data.minimumStock),
            active: data.active !== false,
        };
    });

    const activeProducts = products.filter(
        (product) => product.active !== false
    );

    const totalProducts = activeProducts.length;

    const totalStock = activeProducts.reduce(
        (total, product) => total + product.currentStock,
        0
    );

    const lowStockProducts = activeProducts
        .filter(
            (product) =>
                product.currentStock <= product.minimumStock
        )
        .sort(
            (a, b) => a.currentStock - b.currentStock
        );

    // -----------------------------
    // BILLS
    // -----------------------------

    const bills: DashboardBill[] = billsSnapshot.docs.map((doc) => {
        const data = doc.data();

        return {
            id: doc.id,
            billNumber: data.billNumber,
            billDate: getDateString(
                data.billDate ?? data.date ?? data.createdAt
            ),
            grandTotal: toNumber(data.grandTotal),
            paidAmount: toNumber(data.paidAmount),
            paymentStatus: data.paymentStatus,
            customerName:
                data.customerName ??
                data.customer?.name ??
                "Walk-in Customer",
        };
    });

    const today = new Date()
        .toISOString()
        .slice(0, 10);

    const todayBills = bills.filter(
        (bill) => bill.billDate === today
    );

    const todaySales = todayBills.reduce(
        (total, bill) => total + bill.grandTotal,
        0
    );

    const todayBillsCount = todayBills.length;

    const outstanding = bills.reduce(
        (total, bill) =>
            total +
            Math.max(
                0,
                bill.grandTotal - bill.paidAmount
            ),
        0
    );

    // -----------------------------
    // SALES CHART
    // Last 7 days
    // -----------------------------

    const salesMap = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
        const date = new Date();

        date.setDate(date.getDate() - i);

        const dateString = date
            .toISOString()
            .slice(0, 10);

        salesMap.set(dateString, 0);
    }

    bills.forEach((bill) => {
        if (!bill.billDate) return;

        if (salesMap.has(bill.billDate)) {
            salesMap.set(
                bill.billDate,
                (salesMap.get(bill.billDate) ?? 0) +
                bill.grandTotal
            );
        }
    });

    const salesChart: SalesChartData[] =
        Array.from(salesMap.entries()).map(
            ([date, amount]) => ({
                date,
                amount,
            })
        );

    // -----------------------------
    // STOCK IN
    // -----------------------------

    const recentStockIn: DashboardStockIn[] =
        stockInsSnapshot.docs
            .map((doc) => {
                const data = doc.data();

                return {
                    id: doc.id,
                    supplier: String(
                        data.supplier ?? "Unknown Supplier"
                    ),
                    invoiceNumber: String(
                        data.invoiceNumber ?? "-"
                    ),
                    invoiceDate: getDateString(
                        data.invoiceDate ?? data.deliveryDate
                    ),
                    items: Array.isArray(data.items)
                        ? data.items.map((item: any) => ({
                            product: String(
                                item.product ?? "Unknown Product"
                            ),
                            quantity: toNumber(item.quantity),
                        }))
                        : [],
                };
            })
            .sort((a, b) =>
                b.invoiceDate.localeCompare(
                    a.invoiceDate
                )
            )
            .slice(0, 5);

    return {
        totalProducts,
        totalStock,
        todaySales,
        todayBills: todayBillsCount,
        outstanding,
        lowStockProducts,
        recentStockIn,
        salesChart,
    };
}