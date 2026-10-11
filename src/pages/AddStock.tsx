import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Package,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/config";

interface StockItem {
    id: number;
    productId: string;
    product: string;
    batch: string;
    manufacturingDate: string;
    expiryDate: string;
    pack: string;
    quantity: number;
    rate: number;
}
interface Product {
    id: string;
    name: string;
    category: string;
    manufacturer: string;
    sellingPrice: number;
    minimumStock: number;
    currentStock: number;
    active: boolean;
}

function AddStock() {
    const [items, setItems] = useState<StockItem[]>([
        {
            id: Date.now(),
            productId: "",
            product: "",
            batch: "",
            manufacturingDate: "",
            expiryDate: "",
            pack: "",
            quantity: 0,
            rate: 0,
        },
    ]);

    const addProduct = () => {
        setItems((currentItems) => [
            ...currentItems,
            {
                id: Date.now() + Math.random(),
                productId: "",
                product: "",
                batch: "",
                manufacturingDate: "",
                expiryDate: "",
                pack: "",
                quantity: 0,
                rate: 0,
            },
        ]);
    };
    const [products, setProducts] = useState<Product[]>([]);
    useEffect(() => {
        loadProducts();
    }, []);

    const removeProduct = (id: number) => {
        setItems((currentItems) =>
            currentItems.filter((item) => item.id !== id)
        );
    };

    const updateItem = (
        id: number,
        field: keyof StockItem,
        value: string | number
    ) => {
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item
            )
        );
    };

    const getItemAmount = (item: StockItem) => {
        return item.quantity * item.rate;
    };

    const subtotal = useMemo(() => {
        return items.reduce(
            (total, item) => total + getItemAmount(item),
            0
        );
    }, [items]);
    const [supplierDetails, setSupplierDetails] = useState({
        supplier: "",
        invoiceNumber: "",
        invoiceDate: "",
        billMode: "Credit",
        deliveryDate: "",
        transport: "",
        notes: "",
    });

    const loadProducts = async () => {
        try {
            const snapshot = await getDocs(
                collection(db, "products")
            );

            const loadedProducts: Product[] = snapshot.docs.map(
                (document) => {
                    const data = document.data();

                    return {
                        id: document.id,
                        name: typeof data.name === "string" ? data.name : "",
                        category:
                            typeof data.category === "string"
                                ? data.category
                                : "",
                        manufacturer:
                            typeof data.manufacturer === "string"
                                ? data.manufacturer
                                : "",
                        sellingPrice:
                            typeof data.sellingPrice === "number"
                                ? data.sellingPrice
                                : 0,
                        minimumStock:
                            typeof data.minimumStock === "number"
                                ? data.minimumStock
                                : 0,
                        currentStock:
                            typeof data.currentStock === "number"
                                ? data.currentStock
                                : 0,
                        active:
                            typeof data.active === "boolean"
                                ? data.active
                                : true,
                    };
                }
            );

            setProducts(loadedProducts);

            console.log(
                "========== PRODUCTS LOADED FOR STOCK IN =========="
            );
            console.table(loadedProducts);
        } catch (error) {
            console.error("Failed to load products:", error);
        }
    };
    const saveStock = async () => {
        console.log("Saving stock...");

        // 1. Basic validation
        if (!supplierDetails.supplier.trim()) {
            alert("Please enter supplier / dealer name.");
            return;
        }

        if (!supplierDetails.invoiceNumber.trim()) {
            alert("Please enter invoice number.");
            return;
        }

        if (!supplierDetails.invoiceDate) {
            alert("Please select invoice date.");
            return;
        }

        if (items.length === 0) {
            alert("Please add at least one product.");
            return;
        }

        for (const item of items) {
            if (!item.productId) {
                alert("Please select a product for all items.");
                return;
            }
            const selectedProduct = products.find(
                (product) => product.id === item.productId
            );

            if (!selectedProduct) {
                alert(
                    `Product "${item.product}" is no longer available. Please match the product again.`
                );
                return;
            }

            if (!item.product.trim()) {
                alert("Please select a valid product for all items.");
                return;
            }

            if (!item.batch.trim()) {
                alert(`Please enter batch number for ${item.product}.`);
                return;
            }

            if (item.quantity <= 0) {
                alert(`Quantity must be greater than 0 for ${item.product}.`);
                return;
            }

            if (item.rate <= 0) {
                alert(`Rate must be greater than 0 for ${item.product}.`);
                return;
            }
        }

        try {
            const batch = writeBatch(db);

            // 2. Create Stock In document
            const stockInRef = doc(collection(db, "stockIns"));

            const stockInData = {
                supplier: supplierDetails.supplier.trim(),
                invoiceNumber: supplierDetails.invoiceNumber.trim(),
                invoiceDate: supplierDetails.invoiceDate,
                billMode: supplierDetails.billMode,
                deliveryDate: supplierDetails.deliveryDate,
                transport: supplierDetails.transport.trim(),
                notes: supplierDetails.notes.trim(),

                items: items.map((item) => ({
                    productId: item.productId,
                    product: item.product.trim(),
                    batch: item.batch.trim(),
                    manufacturingDate: item.manufacturingDate,
                    expiryDate: item.expiryDate,
                    pack: item.pack.trim(),
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: getItemAmount(item),
                })),

                subtotal,
                grandTotal: subtotal,
                createdAt: serverTimestamp(),
            };

            batch.set(stockInRef, stockInData);

            // 3. Process every stock item
            for (const item of items) {
                // -----------------------------------------
                // A. Create stock movement
                // -----------------------------------------

                const movementRef = doc(
                    collection(db, "stockMovements")
                );

                batch.set(movementRef, {
                    stockInId: stockInRef.id,
                    product: item.product.trim(),
                    productId: item.productId,
                    batch: item.batch.trim(),
                    pack: item.pack.trim(),
                    type: "STOCK_IN",
                    quantity: item.quantity,
                    rate: item.rate,
                    amount: getItemAmount(item),

                    invoiceNumber:
                        supplierDetails.invoiceNumber.trim(),

                    supplier:
                        supplierDetails.supplier.trim(),

                    movementDate:
                        supplierDetails.invoiceDate,

                    createdAt: serverTimestamp(),
                });

                // -----------------------------------------
                // B. Create unique batch ID
                // -----------------------------------------

                const batchId =
                    `${item.productId}_${item.batch
                        .trim()
                        .replace(/\s+/g, "_")}`;

                const batchRef = doc(
                    db,
                    "productBatches",
                    batchId
                );

                // -----------------------------------------
                // C. Check whether batch already exists
                // -----------------------------------------

                const existingBatch = await getDoc(batchRef);

                if (existingBatch.exists()) {

                    // Existing batch → increase quantity
                    batch.update(batchRef, {
                        quantityReceived: increment(item.quantity),
                        currentQuantity: increment(item.quantity),
                        updatedAt: serverTimestamp(),

                        // Keep latest purchase information
                        purchaseRate: item.rate,
                        supplier:
                            supplierDetails.supplier.trim(),
                        invoiceNumber:
                            supplierDetails.invoiceNumber.trim(),
                    });

                    console.log(
                        "Existing batch updated:",
                        batchId
                    );

                } else {

                    // New batch → create it
                    batch.set(batchRef, {
                        productId: item.productId,
                        productName: item.product.trim(),

                        batchNumber: item.batch.trim(),

                        manufacturingDate:
                            item.manufacturingDate,

                        expiryDate:
                            item.expiryDate,

                        pack: item.pack.trim(),

                        quantityReceived: item.quantity,
                        currentQuantity: item.quantity,

                        purchaseRate: item.rate,

                        supplier:
                            supplierDetails.supplier.trim(),

                        invoiceNumber:
                            supplierDetails.invoiceNumber.trim(),

                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });

                    console.log(
                        "New batch created:",
                        batchId
                    );
                }

                // -----------------------------------------
                // D. Increase product total stock
                // -----------------------------------------

                const productRef = doc(
                    db,
                    "products",
                    item.productId
                );

                console.log("========== STOCK UPDATE ==========");
                console.log("Product:", item.product);
                console.log("Product ID:", item.productId);
                console.log("Quantity being added:", item.quantity);
                console.log("Firebase path:", `products/${item.productId}`);

                batch.update(productRef, {
                    currentStock: increment(item.quantity),
                    updatedAt: serverTimestamp(),
                });
            }

            // 4. Commit everything together
            await batch.commit();

            console.log(
                "Stock saved successfully:",
                stockInRef.id
            );

            alert("Stock saved successfully.");

            // 5. Return to Stock In page
            window.location.href = "/stock-in";

        } catch (error) {
            console.error(
                "Failed to save stock:",
                error
            );

            alert(
                "Unable to save stock. Please try again."
            );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">

            {/* Header */}
            <div className="border-b border-green-100 bg-white px-6 py-5">
                <div className="flex items-center gap-4">

                    <Link
                        to="/stock-in"
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Add Stock
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Manually record stock received from supplier
                        </p>
                    </div>

                </div>
            </div>

            <main className="p-6">

                {/* Supplier Details */}
                <section className="rounded-2xl border bg-white p-6 shadow-sm">

                    <div className="flex items-center gap-3">

                        <div className="rounded-xl bg-green-50 p-3">
                            <Package className="h-5 w-5 text-green-600" />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                Supplier Details
                            </h2>

                            <p className="text-sm text-slate-500">
                                Enter details from the supplier invoice
                            </p>
                        </div>

                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Supplier / Dealer
                            </label>

                            <input
                                type="text"
                                value={supplierDetails.supplier}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        supplier: e.target.value,
                                    })
                                }
                                placeholder="Enter supplier name"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Invoice Number
                            </label>

                            <input
                                type="text"
                                value={supplierDetails.invoiceNumber}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        invoiceNumber: e.target.value,
                                    })
                                }
                                placeholder="Enter invoice number"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Invoice Date
                            </label>

                            <input
                                type="date"
                                value={supplierDetails.invoiceDate}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        invoiceDate: e.target.value,
                                    })
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Bill Mode
                            </label>

                            <select
                                value={supplierDetails.billMode}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        billMode: e.target.value,
                                    })
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            >
                                <option>Credit</option>
                                <option>Cash</option>
                                <option>UPI</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Delivery Date
                            </label>

                            <input
                                type="date"
                                value={supplierDetails.deliveryDate}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        deliveryDate: e.target.value,
                                    })
                                }
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-600">
                                Transport
                            </label>

                            <input
                                type="text"
                                value={supplierDetails.transport}
                                onChange={(e) =>
                                    setSupplierDetails({
                                        ...supplierDetails,
                                        transport: e.target.value,
                                    })
                                }
                                placeholder="Transport name"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                            />
                        </div>

                    </div>

                </section>

                {/* Products */}
                <section className="mt-6 rounded-2xl border bg-white shadow-sm">

                    <div className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">
                                Stock Items
                            </h2>

                            <p className="text-sm text-slate-500">
                                Add all products received in this invoice
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={addProduct}
                            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Product
                        </button>

                    </div>

                    <div className="overflow-x-auto">

                        <table className="w-full min-w-[1100px] text-left text-sm">

                            <thead className="bg-slate-50">

                                <tr className="border-b">

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Product
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Batch No.
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Mfg. Date
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Expiry Date
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Pack
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Qty
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Rate
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Amount
                                    </th>

                                    <th className="px-4 py-4 font-semibold text-slate-600">
                                        Action
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                {items.map((item) => (

                                    <tr
                                        key={item.id}
                                        className="border-b"
                                    >

                                        {/* Product */}
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.productId}
                                                onChange={(e) => {
                                                    const selectedProduct = products.find(
                                                        (product) => product.id === e.target.value
                                                    );

                                                    if (!selectedProduct) {
                                                        return;
                                                    }

                                                    updateItem(
                                                        item.id,
                                                        "productId",
                                                        selectedProduct.id
                                                    );

                                                    updateItem(
                                                        item.id,
                                                        "product",
                                                        selectedProduct.name
                                                    );

                                                    updateItem(
                                                        item.id,
                                                        "rate",
                                                        selectedProduct.sellingPrice
                                                    );
                                                }}
                                                className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500"
                                            >
                                                <option value="">
                                                    Select product
                                                </option>

                                                {products.map((product) => (
                                                    <option
                                                        key={product.id}
                                                        value={product.id}
                                                    >
                                                        {product.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Batch */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.batch}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "batch",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="Batch"
                                                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Manufacturing */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="date"
                                                value={item.manufacturingDate}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "manufacturingDate",
                                                        e.target.value
                                                    )
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Expiry */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="date"
                                                value={item.expiryDate}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "expiryDate",
                                                        e.target.value
                                                    )
                                                }
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Pack */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.pack}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "pack",
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="1 KG"
                                                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Quantity */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.quantity || ""}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "quantity",
                                                        Number(e.target.value)
                                                    )
                                                }
                                                placeholder="0"
                                                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Rate */}
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.rate || ""}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "rate",
                                                        Number(e.target.value)
                                                    )
                                                }
                                                placeholder="0.00"
                                                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                                            />
                                        </td>

                                        {/* Amount */}
                                        <td className="px-4 py-3 font-semibold text-slate-700">
                                            ₹{getItemAmount(item).toFixed(2)}
                                        </td>

                                        {/* Delete */}
                                        <td className="px-4 py-3">

                                            <button
                                                type="button"
                                                onClick={() => removeProduct(item.id)}
                                                disabled={items.length === 1}
                                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>

                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                </section>

                {/* Summary */}
                <section className="mt-6 grid gap-6 lg:grid-cols-2">

                    {/* Notes */}
                    <div className="rounded-2xl border bg-white p-6 shadow-sm">

                        <h2 className="text-lg font-semibold text-slate-800">
                            Notes
                        </h2>

                        <textarea
                            rows={5}
                            value={supplierDetails.notes}
                            onChange={(e) =>
                                setSupplierDetails({
                                    ...supplierDetails,
                                    notes: e.target.value,
                                })
                            }
                            placeholder="Additional notes..."
                            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                        />

                    </div>

                    {/* Summary */}
                    <div className="rounded-2xl border bg-white p-6 shadow-sm">

                        <h2 className="text-lg font-semibold text-slate-800">
                            Purchase Summary
                        </h2>

                        <div className="mt-5 space-y-4 text-sm">

                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Subtotal
                                </span>

                                <span className="font-medium">
                                    ₹{subtotal.toFixed(2)}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Discount
                                </span>

                                <span className="font-medium">
                                    ₹0.00
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    CGST
                                </span>

                                <span className="font-medium">
                                    ₹0.00
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    SGST
                                </span>

                                <span className="font-medium">
                                    ₹0.00
                                </span>
                            </div>

                            <div className="border-t pt-4">

                                <div className="flex justify-between">

                                    <span className="text-lg font-semibold text-slate-800">
                                        Grand Total
                                    </span>

                                    <span className="text-lg font-bold text-green-600">
                                        ₹{subtotal.toFixed(2)}
                                    </span>

                                </div>

                            </div>

                        </div>

                    </div>

                </section>

                {/* Actions */}
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                    <Link
                        to="/stock-in"
                        className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </Link>

                    <button
                        type="button"
                        onClick={saveStock}
                        className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white"
                    >
                        Save Stock
                    </button>

                </div>

            </main>
        </div>
    );
}


export default AddStock;