import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ShoppingCart,
    FileText,
    Package,
    CreditCard,
    TrendingUp,
    AlertTriangle,
    Plus,
    ArrowDownToLine,
    BarChart3,
    ChevronRight,
    CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
    getDashboardData,
    type DashboardData,
} from "../../services/dashboardService";

export default function DashboardMobile() {
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
            console.error("Mobile dashboard loading error:", err);
            setError("Unable to load dashboard. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    const formatCurrency = (amount: number) =>
        `₹${Number(amount || 0).toLocaleString("en-IN", {
            maximumFractionDigits: 2,
        })}`;

    const formatDate = (value: string) => {
        if (!value) return "—";
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        const date = match
            ? new Date(+match[1], +match[2] - 1, +match[3])
            : new Date(value);

        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
            });
    };

    const summaryCards = [
        {
            label: "Today's Sales",
            value: formatCurrency(dashboard?.todaySales ?? 0),
            icon: ShoppingCart,
            color: "bg-emerald-400 text-white",
        },
        {
            label: "Today's Bills",
            value: String(dashboard?.todayBills ?? 0),
            icon: FileText,
            color: "bg-blue-50 text-blue-700",
        },
        {
            label: "Total Stock",
            value: Number(dashboard?.totalStock ?? 0).toLocaleString("en-IN"),
            icon: Package,
            color: "bg-lime-50 text-lime-700",
        },
        {
            label: "Outstanding",
            value: formatCurrency(dashboard?.outstanding ?? 0),
            icon: CreditCard,
            color: "bg-orange-50 text-orange-700",
        },
    ];

    const recentStock = dashboard?.recentStockIn ?? [];
    const lowStock = dashboard?.lowStockProducts ?? [];

    const maxSales = useMemo(
        () => Math.max(
            1,
            ...(dashboard?.salesChart.map((item) => item.amount) ?? [])
        ),
        [dashboard]
    );

    return (
        <main className="min-w-0 space-y-0.5 bg-[#F4F8F5] px-3 py-4 pb-28 text-slate-800">
            {/* Welcome */}
            <section className="flex items-center justify-between gap-0 px-0.5 py-0">
                <div className="min-w-0">
                    <h1 className="text-[20px] font-bold leading-5 text-slate-900">
                        Welcome, Chandrahas Reddy Garu
                    </h1>
                    <h2 className="text-[15px] leading-5 text-slate-500">
                        Keep Going with us
                    </h2>
                </div>
            </section>

            {error && (
                <section
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => void loadDashboard()}
                        className="mt-2 min-h-10 font-semibold underline"
                    >
                        Try again
                    </button>
                </section>
            )}

            {/* Business overview */}
            <section>
                <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                    </span>
                </div>

                <div className="grid grid-cols-4 gap-1">
                    {summaryCards.map((card) => {
                        const Icon = card.icon;

                        return (
                            <article
                                key={card.label}
                                className="flex min-w-0 flex-col items-center rounded-xl border border-slate-100 bg-white p-3 text-center shadow-sm"
                            >
                                {/* Icon at the top */}
                                <span
                                    className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${card.color}`}
                                >
                                    <Icon size={18} />
                                </span>

                                <p className="w-full break-words text-xs font-medium leading-4 text-slate-400">
                                    {card.label}
                                </p>
                                <p className="mt-1 max-w-full break-words text-lg font-bold tracking-tight text-slate-900">
                                    {loading ? "…" : card.value}
                                </p>
                            </article>
                        );
                    })}
                </div>
            </section>

            {/* Sales overview */}
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="font-bold text-slate-900">Last 7 Days Sales Overview</h2>
                    </div>
                    <TrendingUp size={19} className="text-emerald-700" />
                </div>

                <div className="mt-4 flex h-40 items-stretch gap-2 rounded-xl bg-slate-50 px-2 pb-3 pt-3">
                    {loading ? (
                        <p className="m-auto text-sm text-slate-400">Loading sales…</p>
                    ) : dashboard?.salesChart.length ? (
                        dashboard.salesChart.map((item) => {
                            const height =
                                item.amount <= 0
                                    ? 3
                                    : Math.max(5, (item.amount / maxSales) * 100);

                            const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.date);
                            const date = match
                                ? new Date(+match[1], +match[2] - 1, +match[3])
                                : new Date(item.date);

                            const day = Number.isNaN(date.getTime())
                                ? ""
                                : date.toLocaleDateString("en-IN", { weekday: "short" });

                            return (
                                <div
                                    key={item.date}
                                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                                >
                                    <span className="w-full truncate text-center text-[9px] text-slate-500">
                                        {item.amount > 0
                                            ? formatCurrency(item.amount)
                                            : "—"}
                                    </span>
                                    <div className="flex h-full max-h-24 w-full items-end justify-center">
                                        <div
                                            className="w-full max-w-8 rounded-t-md bg-emerald-600"
                                            style={{ height: `${height}%` }}
                                            title={`${item.date}: ${formatCurrency(item.amount)}`}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-500">{day}</span>
                                </div>
                            );
                        })
                    ) : (
                        <p className="m-auto text-center text-xs text-slate-500">
                            No sales data available.
                        </p>
                    )}
                </div>
            </section>

            <section className="grid grid-cols-2 items-start gap-2 ">
                {/* Low Stock Alerts */}
                <section className="min-w-0 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex items-start justify-between gap-1">
                        <div className="flex min-w-0 items-start gap-1.5">
                            <AlertTriangle
                                className="mt-0.5 shrink-0 text-red-600"
                                size={16}
                            />
                            <div className="min-w-0">
                                <h2 className="break-words text-[11px] font-bold leading-4 text-slate-900">
                                    Low Stock Alerts
                                </h2>
                                <p className="text-[9px] leading-3 text-slate-500">
                                    Needs attention
                                </p>
                            </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            {loading ? "…" : lowStock.length}
                        </span>
                    </div>

                    <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
                        {loading ? (
                            <p className="py-3 text-center text-[10px] text-slate-400">
                                Checking inventory…
                            </p>
                        ) : lowStock.length ? (
                            lowStock.slice(0, 3).map((product) => (
                                <div
                                    key={product.id}
                                    className="flex min-w-0 items-start justify-between gap-1 rounded-lg border border-red-100 bg-red-50/70 p-1.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words text-[10px] font-semibold leading-3.5 text-slate-800">
                                            {product.name}
                                        </p>
                                        <p className="mt-1 break-words text-[9px] leading-3 text-slate-500">
                                            Min: {product.minimumStock}
                                        </p>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-bold leading-4 text-red-700">
                                            {product.currentStock}
                                        </p>
                                        <p className="text-[8px] leading-3 text-red-600">
                                            left
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center py-4 text-center">
                                <CheckCircle2
                                    className="text-emerald-600"
                                    size={23}
                                />
                                <p className="mt-1 text-[10px] font-semibold text-emerald-800">
                                    Stock levels look good
                                </p>
                                <p className="mt-1 text-[9px] text-slate-500">
                                    No low-stock alerts.
                                </p>
                            </div>
                        )}
                    </div>

                    <Link
                        to="/products"
                        className="mt-2 flex min-h-8 items-center justify-center rounded-md bg-red-50 px-1 text-center text-[10px] font-semibold text-red-700"
                    >
                        View Products
                    </Link>
                </section>

                {/* Recent Stock In */}
                <section className="min-w-0 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
                    <div className="flex min-w-0 items-start justify-between gap-1">
                        <div className="min-w-0">
                            <h2 className="break-words text-[11px] font-bold leading-4 text-slate-900">
                                Recent Stock In
                            </h2>
                            <p className="mt-0.5 text-[9px] leading-3 text-slate-500">
                                Latest received
                            </p>
                        </div>

                        <Link
                            to="/stock-in-history"
                            aria-label="View all stock-in records"
                            className="flex min-h-12 shrink-0 items-center text-[9px] font-semibold text-emerald-800"
                        >
                            All
                            <ChevronRight size={12} />
                        </Link>
                    </div>

                    <div className="mt-2 space-y-2">
                        {loading ? (
                            <p className="py-3 text-center text-[10px] text-slate-400">
                                Loading records…
                            </p>
                        ) : recentStock.length ? (
                            recentStock.slice(0, 1).map((record) => {
                                const firstItem = record.items?.[0];

                                const totalQuantity = (record.items ?? []).reduce(
                                    (sum, item) =>
                                        sum + Number(item.quantity || 0),
                                    0
                                );

                                return (
                                    <article
                                        key={record.id}
                                        className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-1.5"
                                    >
                                        <div className="min-w-0">
                                            <p className="break-words text-[10px] font-semibold leading-3.5 text-slate-800">
                                                {firstItem?.product ??
                                                    "Multiple Products"}
                                            </p>

                                            <p className="mt-1 break-words text-[9px] leading-3 text-slate-500">
                                                {record.supplier ||
                                                    "Supplier not recorded"}
                                            </p>
                                        </div>

                                        <div className="mt-1.5">
                                            <span className="inline-block max-w-full break-words rounded-md bg-emerald-100 px-1.5 py-1 text-[9px] font-bold text-emerald-800">
                                                Qty {totalQuantity}
                                            </span>
                                        </div>

                                        <div className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5 text-[9px] leading-3 text-slate-500">
                                            <p className="break-words">
                                                Inv: {record.invoiceNumber || "—"}
                                            </p>
                                            <p className="break-words">
                                                {formatDate(record.invoiceDate)}
                                            </p>
                                        </div>
                                    </article>
                                );
                            })
                        ) : (
                            <p className="py-4 text-center text-[10px] text-slate-500">
                                No stock-in records yet.
                            </p>
                        )}
                    </div>

                    <Link
                        to="/stock-in-history"
                        className="mt-2 flex min-h-7 items-center justify-center rounded-md bg-emerald-50 px-1 text-center text-[10px] font-semibold text-emerald-800"
                    >
                        View History
                    </Link>
                </section>

            </section>
            {/* Quick actions */}
            <section>
                <div className="mb-3">
                    <h2 className="font-bold text-slate-900">Quick Actions</h2>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    <Link
                        to="/billing"
                        className="flex min-h-20 flex-col items-center justify-between rounded-xl bg-emerald-700 p-3 text-white"
                    >
                        <ShoppingCart size={26} />
                        <span className="text-sm font-semibold">Create Bill</span>
                    </Link>

                    <Link
                        to="/stock-in/add"
                        className="flex min-h-20 flex-col items-center justify-between rounded-xl border border-emerald-100 bg-white p-3 text-emerald-900"
                    >
                        <Plus size={35} className="text-emerald-700" />
                        <span className="text-sm font-semibold">Add Stock</span>
                    </Link>

                    <Link
                        to="/scan-invoice"
                        className="flex min-h-20 flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                    >
                        <ArrowDownToLine size={35} className="text-emerald-700" />
                        <span className="text-sm font-semibold">Scan Invoice</span>
                    </Link>

                    <Link
                        to="/reports"
                        className="flex min-h-20 flex-col items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                    >
                        <BarChart3 size={35} className="text-emerald-700" />
                        <span className="text-sm font-semibold">View Reports</span>
                    </Link>
                </div>
            </section>
        </main>
    );
}