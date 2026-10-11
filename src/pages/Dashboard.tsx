
import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Package,
    ShoppingCart,
    FileText,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    Plus,
    ArrowDownToLine,
    RefreshCw,
    ScanLine,
    BarChart3,
    ChevronRight,
    CalendarDays,
    CheckCircle2,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
    getDashboardData,
    type DashboardData,
} from "../services/dashboardService";

function Dashboard() {
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await getDashboardData();
            setDashboard(data);
        } catch (err) {
            console.error("Dashboard loading error:", err);

            setError(
                "Unable to load dashboard data. Check your connection and try again."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    const maxSales = useMemo(
        () =>
            Math.max(
                1,
                ...(dashboard?.salesChart.map((item) => item.amount) ?? [])
            ),
        [dashboard]
    );

    const formatCurrency = (amount: number) =>
        `₹${Number(amount || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
        })}`;

    const formatDate = (value: string) => {
        if (!value) return "—";

        // Parse date-only strings in local calendar time.
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

        const date = match
            ? new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            )
            : new Date(value);

        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const getDayName = (value: string) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

        const date = match
            ? new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            )
            : new Date(value);

        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleDateString("en-IN", {
                weekday: "short",
            });
    };

    const summaryCards = [
        {
            label: "Today's Sales",
            value: formatCurrency(dashboard?.todaySales ?? 0),
            description: "Sales recorded today",
            icon: ShoppingCart,
            iconStyle: "bg-emerald-50 text-emerald-700",
            accent: "border-l-emerald-500",
        },
        {
            label: "Today's Bills",
            value: String(dashboard?.todayBills ?? 0),
            description: "Bills generated today",
            icon: FileText,
            iconStyle: "bg-blue-50 text-blue-700",
            accent: "border-l-blue-500",
        },
        {
            label: "Total Stock",
            value: Number(dashboard?.totalStock ?? 0).toLocaleString(
                "en-IN"
            ),
            description: "Available stock quantity",
            icon: Package,
            iconStyle: "bg-lime-50 text-lime-700",
            accent: "border-l-lime-600",
        },
        {
            label: "Outstanding",
            value: formatCurrency(dashboard?.outstanding ?? 0),
            description: "Customer balances due",
            icon: CreditCard,
            iconStyle: "bg-orange-50 text-orange-700",
            accent: "border-l-orange-500",
        },
    ];

    const recentStock = dashboard?.recentStockIn ?? [];
    const lowStock = dashboard?.lowStockProducts ?? [];

    return (
        <div className="min-h-screen min-w-0 bg-[#f4f8f4] text-slate-800">
            {/* Dashboard header: hidden on phones because MainLayout
                already provides the compact mobile header. */}
            <header className="sticky top-0 z-20 hidden border-b border-emerald-900/10 bg-white/95 backdrop-blur sm:block">
                <div className="flex min-h-[68px] items-center justify-between gap-3 px-6 py-3 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
                            <Package className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-lg font-bold text-emerald-950">
                                New Balaji Ruthu Depo
                            </p>
                            <p className="truncate text-xs text-slate-500">
                                Stock &amp; Sales Dashboard
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => void loadDashboard()}
                        disabled={loading}
                        aria-label="Refresh dashboard"
                        title="Refresh dashboard"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
                    >
                        <RefreshCw
                            className={`h-5 w-5 ${loading ? "animate-spin" : ""
                                }`}
                        />
                    </button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1600px] space-y-4 px-2 py-3 pb-4 sm:space-y-6 sm:px-6 sm:py-6 sm:pb-8 lg:px-8">
                {/* Welcome panel */}
                <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 to-green-700 p-3.5 text-white shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs text-emerald-100 sm:text-sm">
                                Welcome back
                            </p>

                            <h1 className="mt-1 text-lg font-bold sm:text-2xl">
                                Your business at a glance
                            </h1>

                            <p className="mt-2 max-w-xl text-xs leading-5 text-emerald-100 sm:text-sm">
                                Monitor sales, inventory and incoming stock
                                in one place.
                            </p>
                        </div>

                        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
                            <TrendingUp className="h-7 w-7" />
                        </div>
                    </div>
                </section>

                {/* Error message */}
                {error && (
                    <div
                        role="alert"
                        className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() => void loadDashboard()}
                            className="min-h-10 shrink-0 rounded-lg bg-red-700 px-4 font-semibold text-white hover:bg-red-800"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Business overview */}
                <section aria-label="Business summary">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                            Business Overview
                        </h2>

                        <span className="flex shrink-0 items-center text-xs text-slate-500">
                            <CalendarDays className="mr-1 h-3.5 w-3.5" />
                            Today
                        </span>
                    </div>

                    {/* Two columns on phones; four columns on wide screens */}
                    <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4 xl:gap-5">
                        {summaryCards.map((card) => {
                            const Icon = card.icon;

                            return (
                                <article
                                    key={card.label}
                                    className={`min-w-0 rounded-xl border border-slate-200 border-l-4 ${card.accent} bg-white p-2 shadow-sm sm:p-3 md:rounded-2xl md:p-5`}
                                >
                                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                                        <p className="min-w-0 break-words text-[11px] font-medium leading-4 text-slate-500 sm:text-sm">
                                            {card.label}
                                        </p>

                                        <div
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl ${card.iconStyle}`}
                                        >
                                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </div>
                                    </div>

                                    <p
                                        className="mt-2 break-words text-base font-bold leading-tight tracking-tight text-slate-900 sm:mt-3 sm:text-2xl"
                                        aria-live="polite"
                                    >
                                        {loading ? "…" : card.value}
                                    </p>

                                    <p className="mt-2 hidden text-xs text-slate-400 sm:block">
                                        {card.description}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                {/* Sales chart and low-stock alerts */}
                <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
                    {/* Sales overview */}
                    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-6 xl:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="font-bold text-slate-900">
                                    Sales Overview
                                </h2>

                                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                    Your sales over the last 7 days
                                </p>
                            </div>

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="mt-3 h-44 min-w-0 sm:mt-5 sm:h-60">
                            {loading ? (
                                <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                                    Loading sales…
                                </div>
                            ) : dashboard?.salesChart.length ? (
                                <div className="flex h-full min-w-0 items-stretch gap-1 rounded-xl bg-slate-50 px-1 pb-3 pt-4 sm:gap-3 sm:px-4">
                                    {dashboard.salesChart.map((item) => {
                                        const height =
                                            item.amount <= 0
                                                ? 3
                                                : Math.max(
                                                    5,
                                                    (item.amount /
                                                        maxSales) *
                                                    100
                                                );

                                        return (
                                            <div
                                                key={item.date}
                                                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                                            >
                                                <span className="w-full truncate text-center text-[8px] text-slate-500 sm:text-xs">
                                                    {item.amount > 0
                                                        ? formatCurrency(
                                                            item.amount
                                                        )
                                                        : "—"}
                                                </span>

                                                <div className="flex h-full max-h-36 w-full items-end justify-center">
                                                    <div
                                                        className="w-full max-w-10 rounded-t-md bg-emerald-600 transition-all duration-300"
                                                        style={{
                                                            height: `${height}%`,
                                                        }}
                                                        title={`${formatDate(
                                                            item.date
                                                        )}: ${formatCurrency(
                                                            item.amount
                                                        )}`}
                                                    />
                                                </div>

                                                <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                                                    {getDayName(item.date)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
                                    No sales data available for this period.
                                </div>
                            )}
                        </div>
                    </article>

                    {/* Low-stock alerts */}
                    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 sm:h-10 sm:w-10">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>

                                <div className="min-w-0">
                                    <h2 className="font-bold text-slate-900">
                                        Low Stock Alerts
                                    </h2>

                                    <p className="text-xs text-slate-500">
                                        Products needing attention
                                    </p>
                                </div>
                            </div>

                            <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                {loading ? "…" : lowStock.length}
                            </span>
                        </div>

                        <div className="mt-4 space-y-2">
                            {loading ? (
                                <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-400">
                                    Checking inventory…
                                </div>
                            ) : lowStock.length ? (
                                lowStock.slice(0, 5).map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-semibold text-slate-800">
                                                {product.name}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Minimum: {product.minimumStock}
                                            </p>
                                        </div>

                                        <div className="shrink-0 text-right">
                                            <p className="text-lg font-bold text-red-700">
                                                {product.currentStock}
                                            </p>

                                            <p className="text-[10px] text-red-600">
                                                remaining
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 px-4 py-8 text-center">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />

                                    <p className="mt-2 text-sm font-semibold text-emerald-800">
                                        Stock levels look good
                                    </p>

                                    <p className="mt-1 text-xs text-emerald-700">
                                        No low-stock alerts found.
                                    </p>
                                </div>
                            )}
                        </div>
                    </article>
                </section>

                {/* Recent stock-in and quick actions */}
                <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
                    {/* Recent stock-in */}
                    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
                        <div className="flex items-center justify-between gap-3 p-3.5 sm:p-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10">
                                    <ArrowDownToLine className="h-5 w-5" />
                                </div>

                                <div className="min-w-0">
                                    <h2 className="font-bold text-slate-900">
                                        Recent Stock In
                                    </h2>

                                    <p className="text-xs text-slate-500 sm:text-sm">
                                        Latest received inventory
                                    </p>
                                </div>
                            </div>

                            <Link
                                to="/stock-in"
                                className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 sm:px-3 sm:text-sm"
                            >
                                View all
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>

                        {/* Mobile stock-in cards */}
                        <div className="space-y-3 px-3 pb-3 sm:hidden">
                            {loading ? (
                                <p className="py-6 text-center text-sm text-slate-400">
                                    Loading stock-in records…
                                </p>
                            ) : recentStock.length ? (
                                recentStock.map((record) => {
                                    const firstItem = record.items?.[0];

                                    const totalQuantity = (
                                        record.items ?? []
                                    ).reduce(
                                        (sum, item) =>
                                            sum + Number(item.quantity || 0),
                                        0
                                    );

                                    return (
                                        <div
                                            key={record.id}
                                            className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="break-words text-sm font-semibold text-slate-800">
                                                        {firstItem?.product ??
                                                            "Multiple Products"}
                                                    </p>

                                                    <p className="mt-1 break-words text-xs text-slate-500">
                                                        {record.supplier ||
                                                            "Supplier not recorded"}
                                                    </p>
                                                </div>

                                                <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                                                    Qty {totalQuantity}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
                                                <span className="min-w-0 truncate">
                                                    Invoice:{" "}
                                                    {record.invoiceNumber ||
                                                        "—"}
                                                </span>

                                                <span className="shrink-0">
                                                    {formatDate(
                                                        record.invoiceDate
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="py-8 text-center text-sm text-slate-500">
                                    No stock-in records yet.
                                </p>
                            )}
                        </div>

                        {/* Existing tablet and desktop table */}
                        <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">
                                            Product
                                        </th>

                                        <th className="px-5 py-3 font-semibold">
                                            Supplier
                                        </th>

                                        <th className="px-5 py-3 font-semibold">
                                            Quantity
                                        </th>

                                        <th className="px-5 py-3 font-semibold">
                                            Date
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-5 py-8 text-center text-slate-400"
                                            >
                                                Loading stock-in records…
                                            </td>
                                        </tr>
                                    ) : recentStock.length ? (
                                        recentStock.map((record) => {
                                            const firstItem =
                                                record.items?.[0];

                                            const totalQuantity = (
                                                record.items ?? []
                                            ).reduce(
                                                (sum, item) =>
                                                    sum +
                                                    Number(item.quantity || 0),
                                                0
                                            );

                                            return (
                                                <tr
                                                    key={record.id}
                                                    className="hover:bg-slate-50"
                                                >
                                                    <td className="max-w-48 px-5 py-4 font-medium text-slate-800">
                                                        <span className="block truncate">
                                                            {firstItem?.product ??
                                                                "Multiple Products"}
                                                        </span>
                                                    </td>

                                                    <td className="max-w-40 px-5 py-4 text-slate-600">
                                                        <span className="block truncate">
                                                            {record.supplier ||
                                                                "—"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 font-semibold text-emerald-800">
                                                        {totalQuantity}
                                                    </td>

                                                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                                                        {formatDate(
                                                            record.invoiceDate
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-5 py-8 text-center text-slate-500"
                                            >
                                                No stock-in records yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>

                    {/* Quick actions */}
                    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-6">
                        <h2 className="font-bold text-slate-900">
                            Quick Actions
                        </h2>

                        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                            Common tasks, ready when you need them
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-1 xl:gap-3">
                            <Link
                                to="/billing"
                                className="flex min-h-20 flex-col items-start justify-between rounded-xl bg-emerald-700 p-2.5 text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-24 sm:p-4"
                            >
                                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />

                                <span className="mt-3 text-sm font-semibold">
                                    Create Bill
                                </span>
                            </Link>

                            <Link
                                to="/stock-in/add"
                                className="flex min-h-20 flex-col items-start justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-900 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-24 sm:p-4"
                            >
                                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />

                                <span className="mt-3 text-sm font-semibold">
                                    Add Stock
                                </span>
                            </Link>

                            <Link
                                to="/stock-in"
                                className="flex min-h-20 flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-24 sm:p-4"
                            >
                                <ScanLine className="h-5 w-5 text-emerald-700 sm:h-6 sm:w-6" />

                                <span className="mt-3 text-sm font-semibold">
                                    Stock In History
                                </span>
                            </Link>

                            <Link
                                to="/reports"
                                className="flex min-h-20 flex-col items-start justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-24 sm:p-4"
                            >
                                <BarChart3 className="h-5 w-5 text-emerald-700 sm:h-6 sm:w-6" />

                                <span className="mt-3 text-sm font-semibold">
                                    View Reports
                                </span>
                            </Link>
                        </div>
                    </article>
                </section>
            </main>
        </div>
    );
}

export default Dashboard;