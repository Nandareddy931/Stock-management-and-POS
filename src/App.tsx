import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import StockIn from "./pages/StockIn";
import AddStock from "./pages/AddStock";
import Products from "./pages/Products";
import StockInHistory from "./pages/StockInHistory";
import ScanInvoice from "./pages/ScanInvoice";
import Billing from "./pages/Billing";
import Sales from "./pages/Sales";
import BillDetails from "./pages/BillDetails";
import ResponsivePage from "./components/ResponsivePage";
import DashboardMobile from "./pages/mobile/DashboardMobile";
import ProductsMobile from "./pages/mobile/ProductsMobile";
import { useEffect, useState } from "react";
import BillingMobile from "./pages/mobile/BillingMobile";
import StockInMobile from "./pages/mobile/StockInMobile";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route
            path="/"
            element={
              <ResponsivePage desktop={<Dashboard />} mobile={<DashboardMobile />} />} />

          <Route path="/stock-in" element={<ResponsivePage desktop={<StockIn />} mobile={<StockInMobile />} />} />
          <Route path="/stock-in/add" element={<AddStock />} />
          <Route path="/products" element={<ResponsiveProducts />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/billing" element={<ResponsivePage desktop={<Billing />} mobile={<BillingMobile />} />} />
          <Route path="/sales/bill/:billId" element={<BillDetails />} />
          <Route path="/stock-in-history" element={<StockInHistory />} />
          <Route path="/scan-invoice" element={<ScanInvoice />} />


        </Route>
      </Routes>
    </BrowserRouter>
  );
}
function ResponsiveProducts() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia("(max-width: 639px)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile ? <ProductsMobile /> : <Products />;
}
export default App;