import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft, ArrowRight, Barcode, CheckCircle2, CreditCard, FileText,
    Minus, Package, Plus, Printer, Search, Share2, ShoppingCart, Trash2,
    Wallet, Zap,
} from "lucide-react";
import { getProducts, type Product } from "../../services/productService";
import {
    generateBillNumber,
    saveBill,
    type BillItem,
    type PaymentStatus,
} from "../../services/billingService";
import { deductStockForBill } from "../../services/stockService";

const CATEGORIES = [
    "All", "Pesticide", "Insecticide", "Fungicide", "Herbicide",
    "Fertilizer", "Seed", "Other",
] as const;

type PaymentMode = "Cash" | "UPI" | "Card";

interface CartItem extends BillItem {
    stockAvailable: number;
}

const money = (amount: number) =>
    `₹ ${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

const steps = [
    { number: 1, title: "Customer" },
    { number: 2, title: "Products" },
    { number: 3, title: "Payment" },
    { number: 4, title: "Confirm" },
    { number: 5, title: "Receipt" },
];

export default function BillingMobile() {
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(1);

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [billDate] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    });
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
    const [receivedAmount, setReceivedAmount] = useState("");
    const [savedBillNumber, setSavedBillNumber] = useState("");
    const [savedReceipt, setSavedReceipt] = useState<{
        billNumber: string;
        customerName: string;
        customerPhone: string;
        billDate: string;
        items: BillItem[];
        total: number;
        paymentMode: PaymentMode;
        receivedAmount: number;
        changeAmount: number;
        totalQuantity: number;
    } | null>(null);

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const result = await getProducts();
                setProducts(result.filter((product) => product.active));
            } catch (error) {
                console.error("Unable to load products:", error);
                alert("Unable to load products. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        void loadProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase();
        return products.filter((product) => {
            const matchesCategory = category === "All" || product.category === category;
            const matchesSearch =
                !term ||
                product.name.toLowerCase().includes(term) ||
                product.category.toLowerCase().includes(term) ||
                (product.manufacturer ?? "").toLowerCase().includes(term);
            return matchesCategory && matchesSearch;
        });
    }, [products, search, category]);

    const subtotal = useMemo(
        () => cart.reduce((total, item) => total + item.amount, 0),
        [cart],
    );
    const totalQuantity = useMemo(
        () => cart.reduce((total, item) => total + item.quantity, 0),
        [cart],
    );
    const cashReceived = paymentMode === "Cash" ? Number(receivedAmount || 0) : subtotal;
    const changeAmount = paymentMode === "Cash" ? Math.max(0, cashReceived - subtotal) : 0;


    const addToCart = (product: Product) => {
        if (product.currentStock <= 0) {
            alert(`${product.name} is out of stock.`);
            return;
        }
        setCart((current) => {
            const existing = current.find((item) => item.productId === product.id);
            if (existing) {
                if (existing.quantity >= product.currentStock) {
                    alert(`Only ${product.currentStock} units are available.`);
                    return current;
                }
                return current.map((item) =>
                    item.productId === product.id
                        ? {
                            ...item,
                            quantity: item.quantity + 1,
                            amount: (item.quantity + 1) * item.sellingPrice,
                        }
                        : item,
                );
            }
            return [
                ...current,
                {
                    productId: product.id,
                    productName: product.name,
                    quantity: 1,
                    unit: product.unit,
                    sellingPrice: product.sellingPrice,
                    amount: product.sellingPrice,
                    stockAvailable: product.currentStock,
                },
            ];
        });
    };

    const changeQuantity = (productId: string, change: number) => {
        setCart((current) =>
            current
                .map((item) => {
                    if (item.productId !== productId) return item;
                    const quantity = item.quantity + change;
                    if (quantity > item.stockAvailable) {
                        alert(`Only ${item.stockAvailable} units of ${item.productName} are available.`);
                        return item;
                    }
                    return { ...item, quantity, amount: quantity * item.sellingPrice };
                })
                .filter((item) => item.quantity > 0),
        );
    };

    const removeItem = (productId: string) =>
        setCart((current) => current.filter((item) => item.productId !== productId));

    const proceedFromCustomer = () => {
        if (!customerName.trim() && !customerPhone.trim()) {
            alert("Please enter the customer name or mobile number.");
            return;
        }
        setStep(2);
    };

    const proceedToPayment = () => {
        if (!cart.length) {
            alert("Please add at least one product.");
            return;
        }
        setStep(3);
    };

    const proceedToPreview = () => {
        if (cart.length === 0) {
            alert("Please add at least one product.");
            setStep(2);
            return;
        }
        if (paymentMode === "Cash" && Number(receivedAmount || 0) < subtotal) {
            alert("Enter the full cash amount received before continuing.");
            return;
        }
        setStep(4);
    };

    const completeBill = async () => {
        if (saving) return;

        if (!customerName.trim() && !customerPhone.trim()) {
            alert("Please enter the customer name or mobile number.");
            setStep(1);
            return;
        }

        if (!cart.length) {
            alert("Please add at least one product.");
            setStep(2);
            return;
        }

        if (
            paymentMode === "Cash" &&
            Number(receivedAmount || 0) < subtotal
        ) {
            alert("Cash received must be equal to or greater than the bill total.");
            setStep(3);
            return;
        }

        try {
            setSaving(true);

            const billNumber = generateBillNumber();

            const billItems: BillItem[] = cart.map(
                ({ productId, productName, quantity, unit, sellingPrice, amount }) => ({
                    productId,
                    productName,
                    quantity,
                    unit,
                    sellingPrice,
                    amount,
                })
            );

            const paid = subtotal;
            const finalStatus: PaymentStatus = "Paid";

            const billId = await saveBill({
                billNumber,
                customerName: customerName.trim() || "Walk-in Customer",
                customerPhone: customerPhone.trim() || "0000000000",
                billDate,
                items: billItems,
                subtotal,
                grandTotal: subtotal,
                paidAmount: paid,
                paymentStatus: finalStatus,
            });

            await deductStockForBill(
                billId,
                billNumber,
                cart.map(({ productId, productName, quantity }) => ({
                    productId,
                    productName,
                    quantity,
                }))
            );

            setSavedBillNumber(billNumber);


            setSavedReceipt({
                billNumber,
                customerName: customerName.trim() || "Walk-in Customer",
                customerPhone,
                billDate,
                items: billItems,
                total: subtotal,
                paymentMode,
                receivedAmount: paymentMode === "Cash" ? Number(receivedAmount || 0) : subtotal,
                changeAmount:
                    paymentMode === "Cash"
                        ? Math.max(0, Number(receivedAmount || 0) - subtotal)
                        : 0,
                totalQuantity,
            });

            const refreshedProducts = await getProducts();
            setProducts(refreshedProducts.filter((product) => product.active));

            // Keep the receipt data and display the final saved receipt.
            setStep(5);
            alert(`Bill ${billNumber} saved successfully.`);
        } catch (error) {
            console.error("Error completing bill:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "Unable to complete the bill. Check your bills and stock before retrying."
            );
        } finally {
            setSaving(false);
        }
    };


    const shareBill = async () => {
        const text = [
            "BALAJI STOCK",
            savedBillNumber ? `Bill: ${savedBillNumber}` : "Bill Preview",
            `Customer: ${customerName || "Walk-in Customer"}`,
            customerPhone ? `Mobile: ${customerPhone}` : "",
            ...cart.map((item) => `${item.productName} x ${item.quantity} = ${money(item.amount)}`),
            `Total: ${money(subtotal)}`,
            `Payment: ${paymentMode}`,
        ].filter(Boolean).join("\n");

        if (navigator.share) {
            try {
                await navigator.share({ title: "Balaji Stock Bill", text });
            } catch (error) {
                if (error instanceof Error && error.name !== "AbortError") {
                    console.error("Unable to share bill:", error);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(text);
                alert("Bill summary copied. You can paste it into WhatsApp.");
            } catch {
                alert(text);
            }
        }
    };

    const header = (
        <header className="sticky top-0 z-20 bg-[#087653] px-3 py-3 text-white shadow-md">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-extrabold leading-5">Balaji Stock</h1>
                    <p className="text-xs text-green-100">Create New Bill</p>
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                    Step {step} of 5
                </span>
            </div>
        </header>
    );

    return (
        <div className="min-h-screen bg-[#f2f8f5] pb-6 text-[#17334a]">
            {header}
            <main className="mx-auto max-w-xl space-y-4 p-3 pb-8">
                <div className="grid grid-cols-5 gap-1">
                    {steps.map((item) => (
                        <div key={item.number} className={`rounded-xl px-1 py-2 text-center text-[11px] font-bold ${step >= item.number ? "bg-[#087653] text-white" : "bg-white text-slate-400"}`}>
                            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/10">{step > item.number ? "✓" : item.number}</div>
                            {item.title}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <section className="space-y-4 rounded-2xl border border-[#dcebe5] bg-white p-4 shadow-sm">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-[#087653]">Step 1</p>
                            <h2 className="mt-1 text-xl font-extrabold">Customer details</h2>
                            <p className="mt-1 text-sm text-slate-500">Enter a name or mobile number to start a bill.</p>
                        </div>
                        <label className="block text-sm font-semibold">
                            Customer name
                            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-[#087653] focus:ring-2 focus:ring-emerald-100" />
                        </label>
                        <label className="block text-sm font-semibold">
                            Mobile number
                            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Enter mobile number" inputMode="tel" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-[#087653] focus:ring-2 focus:ring-emerald-100" />
                        </label>
                        <button type="button" onClick={proceedFromCustomer} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087653] px-4 py-3.5 font-extrabold text-white shadow-sm">
                            Proceed to products <ArrowRight size={19} />
                        </button>
                    </section>
                )}

                {step === 2 && (
                    <>
                        <section className="rounded-2xl border border-[#dcebe5] bg-white p-3 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-[#087653]">Step 2</p>
                                    <h2 className="text-lg font-extrabold">Select products</h2>
                                </div>
                                <span className="rounded-full bg-[#e8f6f0] px-3 py-1.5 text-xs font-bold text-[#087653]">{totalQuantity} selected</span>
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-[#dcebe5] bg-[#f8fcfa] px-3 py-3">
                                <Search size={20} className="shrink-0 text-[#087653]" />
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name or scan barcode" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                                <Barcode size={21} className="shrink-0 text-[#087653]" />
                            </div>
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                {CATEGORIES.map((item) => (
                                    <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? "bg-[#087653] text-white" : "bg-[#eef6f2] text-slate-600"}`}>{item}</button>
                                ))}
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-2xl border border-[#dcebe5] bg-white shadow-sm">
                            {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading products…</p> :
                                filteredProducts.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No matching products found.</p> :
                                    <div className="divide-y divide-slate-100">
                                        {filteredProducts.map((product) => {
                                            const item = cart.find((entry) => entry.productId === product.id);
                                            const outOfStock = product.currentStock <= 0;
                                            return <div key={product.id} className="flex items-center gap-3 p-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf6f0] text-[#087653]"><Package size={23} /></div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-sm font-bold">{product.name}</p>
                                                    <p className="mt-1 text-xs text-slate-500">{product.category} · Stock {product.currentStock}</p>
                                                    <p className="mt-1 text-sm font-extrabold text-[#087653]">{money(product.sellingPrice)} <span className="font-normal text-slate-500">/ {product.unit}</span></p>
                                                </div>
                                                {item ? <div className="flex items-center gap-2 rounded-xl bg-[#eaf6f0] px-2 py-2">
                                                    <button type="button" onClick={() => changeQuantity(product.id, -1)} aria-label="Decrease quantity"><Minus size={17} /></button>
                                                    <span className="min-w-4 text-center text-sm font-bold">{item.quantity}</span>
                                                    <button type="button" disabled={item.quantity >= product.currentStock} onClick={() => addToCart(product)} aria-label="Increase quantity" className="disabled:opacity-30"><Plus size={17} /></button>
                                                </div> : <button type="button" disabled={outOfStock} onClick={() => addToCart(product)} className="shrink-0 rounded-xl bg-[#087653] px-3 py-2.5 text-sm font-bold text-white disabled:bg-slate-300">Add</button>}
                                            </div>;
                                        })}
                                    </div>
                            }
                        </section>

                        {cart.length > 0 && (
                            <section className="rounded-2xl border border-[#dcebe5] bg-white p-3 shadow-sm">
                                <h3 className="mb-2 flex items-center gap-2 font-extrabold"><ShoppingCart size={19} className="text-[#087653}" /> Selected items ({cart.length})</h3>
                                <div className="divide-y divide-slate-100">
                                    {cart.map((item) => <div key={item.productId} className="flex items-center gap-2 py-2">
                                        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.productName}</p><p className="text-xs text-slate-500">{item.quantity} × {money(item.sellingPrice)}</p></div>
                                        <span className="text-sm font-extrabold">{money(item.amount)}</span>
                                        <button type="button" onClick={() => removeItem(item.productId)} aria-label={`Remove ${item.productName}`} className="p-1 text-red-500"><Trash2 size={17} /></button>
                                    </div>)}
                                </div>
                                <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 font-extrabold"><span>Current total</span><span className="text-[#087653]">{money(subtotal)}</span></div>
                            </section>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setStep(1)} className="flex items-center justify-center gap-2 rounded-xl border border-[#dcebe5] bg-white px-3 py-3 font-bold"><ArrowLeft size={18} /> Back</button>
                            <button type="button" onClick={proceedToPayment} disabled={!cart.length} className="flex items-center justify-center gap-2 rounded-xl bg-[#087653] px-3 py-3 font-extrabold text-white disabled:bg-slate-300">Proceed <ArrowRight size={18} /></button>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <section className="space-y-4 rounded-2xl border border-[#dcebe5] bg-white p-4 shadow-sm">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-[#087653]">Step 3</p>
                            <h2 className="mt-1 text-xl font-extrabold">Payment</h2>
                            <p className="mt-1 text-sm text-slate-500">Choose how the customer is paying.</p>
                        </div>
                        <div className="rounded-2xl bg-[#eaf6f0] p-4">
                            <p className="text-sm font-semibold text-slate-600">Amount to pay</p>
                            <p className="mt-1 text-3xl font-extrabold text-[#087653]">{money(subtotal)}</p>
                            <p className="mt-1 text-xs text-slate-500">{totalQuantity} items · {cart.length} products</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {([{ name: "Cash" as const, icon: Wallet }, { name: "UPI" as const, icon: Zap }, { name: "Card" as const, icon: CreditCard }]).map(({ name, icon: Icon }) => (
                                <button key={name} type="button" onClick={() => setPaymentMode(name)} className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-sm font-extrabold ${paymentMode === name ? "border-[#087653] bg-[#087653] text-white" : "border-[#dcebe5] bg-white text-slate-700"}`}><Icon size={23} />{name}</button>
                            ))}
                        </div>
                        {paymentMode === "Cash" && (
                            <label className="block text-sm font-bold">
                                Cash received
                                <input type="number" min={subtotal} step="0.01" inputMode="decimal" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} placeholder={`Enter at least ${subtotal}`} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-lg outline-none focus:border-[#087653]" />
                                <span className="mt-2 flex justify-between text-xs font-medium text-slate-500"><span>Change to return</span><span className="font-extrabold text-[#087653]">{money(changeAmount)}</span></span>
                            </label>
                        )}
                        {paymentMode !== "Cash" && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">No received-amount entry is needed for {paymentMode}. The full bill total will be recorded as paid.</div>}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setStep(2)} className="flex items-center justify-center gap-2 rounded-xl border border-[#dcebe5] px-3 py-3 font-bold"><ArrowLeft size={18} /> Back</button>
                            <button type="button" onClick={proceedToPreview} className="flex items-center justify-center gap-2 rounded-xl bg-[#087653] px-3 py-3 font-extrabold text-white">Preview bill <ArrowRight size={18} /></button>
                        </div>
                    </section>
                )}

                {step === 4 && (
                    <>
                        <section className="overflow-hidden rounded-2xl border border-[#dcebe5] bg-white shadow-sm">
                            <div className="bg-[#087653] p-5 text-center text-white">
                                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15"><CheckCircle2 size={29} /></div>
                                <h2 className="text-xl font-extrabold">Balaji Stock</h2>
                                <p className="mt-1 text-sm text-green-100">Bill preview</p>
                                <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">NOT SAVED YET</p>
                            </div>
                            <div className="space-y-3 p-4">
                                <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Bill date</span><span className="font-semibold">{billDate}</span></div>
                                <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Customer</span><span className="text-right font-semibold">{customerName.trim() || "Walk-in Customer"}</span></div>
                                {customerPhone.trim() && <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">Mobile</span><span className="font-semibold">{customerPhone}</span></div>}
                                <div className="border-t border-dashed border-slate-200 pt-3">
                                    <div className="mb-2 grid grid-cols-[1fr_auto] text-xs font-bold uppercase text-slate-500"><span>Item / Qty × Rate</span><span>Amount</span></div>
                                    {cart.map((item) => <div key={item.productId} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm">
                                        <div className="min-w-0"><p className="font-semibold">{item.productName}</p><p className="mt-0.5 text-xs text-slate-500">{item.quantity} {item.unit} × {money(item.sellingPrice)}</p></div>
                                        <span className="shrink-0 font-bold">{money(item.amount)}</span>
                                    </div>)}
                                </div>
                                <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
                                    <div className="flex justify-between text-sm"><span>Items</span><span>{totalQuantity}</span></div>
                                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                                    <div className="flex justify-between text-lg font-extrabold text-[#087653]"><span>Grand total</span><span>{money(subtotal)}</span></div>
                                    <div className="flex justify-between text-sm"><span>Payment method</span><span className="font-bold">{paymentMode}</span></div>
                                    {paymentMode === "Cash" && <div className="flex justify-between text-sm"><span>Cash received</span><span>{money(Number(receivedAmount || 0))}</span></div>}
                                    {paymentMode === "Cash" && <div className="flex justify-between text-sm font-bold text-[#087653]"><span>Change</span><span>{money(changeAmount)}</span></div>}
                                </div>
                            </div>
                            <div className="border-t border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Thank you for your business!</div>
                        </section>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setStep(3)} className="flex items-center justify-center gap-2 rounded-xl border border-[#dcebe5] bg-white px-3 py-3 font-bold"><ArrowLeft size={18} /> Edit payment</button>
                            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl border border-[#dcebe5] bg-white px-3 py-3 font-bold"><Printer size={18} /> Print</button>
                        </div>
                        <button type="button" disabled={saving} onClick={() => void completeBill()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087653] px-4 py-4 text-base font-extrabold text-white shadow-md disabled:bg-slate-300">
                            <CheckCircle2 size={21} /> {saving ? "Saving bill…" : "Final Bill — Save & Deduct Stock"}
                        </button>
                        <button type="button" onClick={() => void shareBill()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dcebe5] bg-white px-4 py-3 font-bold text-[#087653]"><Share2 size={18} /> Share bill summary</button>
                        <button type="button" onClick={() => setStep(2)} className="w-full py-2 text-sm font-semibold text-slate-500">Add or edit products</button>
                    </>
                )}
                {step === 5 && savedReceipt && (
                    <section className="space-y-4">
                        <div
                            id="saved-bill-receipt"
                            className="overflow-hidden rounded-2xl border border-[#dcebe5] bg-white shadow-sm"
                        >
                            <div className="bg-[#087653] p-5 text-center text-white">
                                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                                    <CheckCircle2 size={29} />
                                </div>

                                <h2 className="text-xl font-extrabold">Balaji Stock</h2>
                                <p className="mt-1 text-sm text-green-100">Saved Bill Receipt</p>

                                <p className="mt-3 text-sm font-bold">
                                    Bill No: {savedReceipt.billNumber}
                                </p>
                                <p className="mt-1 text-xs text-green-100">
                                    SAVED SUCCESSFULLY
                                </p>
                            </div>

                            <div className="space-y-3 p-4">
                                <div className="flex justify-between gap-3 text-sm">
                                    <span className="text-slate-500">Bill date</span>
                                    <span className="font-semibold">{savedReceipt.billDate}</span>
                                </div>

                                <div className="flex justify-between gap-3 text-sm">
                                    <span className="text-slate-500">Customer</span>
                                    <span className="text-right font-semibold">
                                        {savedReceipt.customerName}
                                    </span>
                                </div>

                                {savedReceipt.customerPhone.trim() && (
                                    <div className="flex justify-between gap-3 text-sm">
                                        <span className="text-slate-500">Mobile</span>
                                        <span className="font-semibold">
                                            {savedReceipt.customerPhone}
                                        </span>
                                    </div>
                                )}

                                <div className="border-t border-dashed border-slate-200 pt-3">
                                    <div className="mb-2 grid grid-cols-[1fr_auto] text-xs font-bold uppercase text-slate-500">
                                        <span>Item / Qty × Rate</span>
                                        <span>Amount</span>
                                    </div>

                                    {savedReceipt.items.map((item) => (
                                        <div
                                            key={item.productId}
                                            className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-semibold">{item.productName}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    {item.quantity} {item.unit} × {money(item.sellingPrice)}
                                                </p>
                                            </div>

                                            <span className="shrink-0 font-bold">
                                                {money(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
                                    <div className="flex justify-between text-sm">
                                        <span>Total quantity</span>
                                        <span>{savedReceipt.totalQuantity}</span>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span>Payment method</span>
                                        <span className="font-bold">{savedReceipt.paymentMode}</span>
                                    </div>

                                    {savedReceipt.paymentMode === "Cash" && (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <span>Cash received</span>
                                                <span>{money(savedReceipt.receivedAmount)}</span>
                                            </div>

                                            <div className="flex justify-between text-sm">
                                                <span>Change returned</span>
                                                <span>{money(savedReceipt.changeAmount)}</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-extrabold text-[#087653]">
                                        <span>Grand total</span>
                                        <span>{money(savedReceipt.total)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                                Thank you for your business!
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087653] px-4 py-4 text-base font-extrabold text-white shadow-md"
                        >
                            <Printer size={21} />
                            Print Bill
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const receipt = savedReceipt;
                                const text = [
                                    "BALAJI STOCK",
                                    `Bill No: ${receipt.billNumber}`,
                                    `Date: ${receipt.billDate}`,
                                    `Customer: ${receipt.customerName}`,
                                    receipt.customerPhone ? `Mobile: ${receipt.customerPhone}` : "",
                                    ...receipt.items.map(
                                        (item) =>
                                            `${item.productName} x ${item.quantity} = ${money(item.amount)}`
                                    ),
                                    `Total: ${money(receipt.total)}`,
                                    `Payment: ${receipt.paymentMode}`,
                                ]
                                    .filter(Boolean)
                                    .join("\n");

                                if (navigator.share) {
                                    void navigator.share({
                                        title: "Balaji Stock Bill",
                                        text,
                                    }).catch((error) => {
                                        if (error instanceof Error && error.name !== "AbortError") {
                                            console.error("Unable to share receipt:", error);
                                        }
                                    });
                                } else {
                                    void navigator.clipboard.writeText(text).then(
                                        () => alert("Bill summary copied."),
                                        () => alert(text)
                                    );
                                }
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dcebe5] bg-white px-4 py-3 font-bold text-[#087653]"
                        >
                            <Share2 size={18} />
                            Share Bill
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setCart([]);
                                setSearch("");
                                setCategory("All");
                                setCustomerName("");
                                setCustomerPhone("");
                                setPaymentMode("Cash");
                                setReceivedAmount("");
                                setSavedBillNumber("");
                                setSavedReceipt(null);
                                setStep(1);
                            }}
                            className="w-full rounded-xl border border-[#dcebe5] bg-white px-4 py-3 font-bold text-slate-700"
                        >
                            Create New Bill
                        </button>
                    </section>
                )}


                <p className="px-2 text-center text-xs text-slate-400">Tax and discount are not included in this total.</p>
            </main>
        </div>
    );
}
