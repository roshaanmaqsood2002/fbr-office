import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  type Location,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import Businesses from "./pages/Business";
import BusinessNew from "./pages/BusinessNew";
import BusinessWorkspace from "./pages/BusinessWorkspace";
import InvoiceWizard from "./pages/InvoiceWizard";
import InvoiceDetail from "./pages/InvoiceDetail";
import FirmSettings from "./pages/FirmSettings";

function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation as
    | Location
    | undefined;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/businesses" element={<Businesses />} />
            <Route path="/businesses/new" element={<BusinessNew />} />
            <Route path="/businesses/:id" element={<BusinessWorkspace />} />
            <Route
              path="/businesses/:id/invoices/new"
              element={<InvoiceWizard />}
            />
            <Route
              path="/businesses/:id/invoices/:invoiceId"
              element={<InvoiceDetail />}
            />
            <Route element={<ProtectedRoute roles={["owner", "admin"]} />}>
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<FirmSettings />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      {backgroundLocation && (
        <Routes location={location}>
          <Route element={<ProtectedRoute />}>
            <Route path="/businesses/new" element={<BusinessNew />} />
            <Route
              path="/businesses/:id/invoices/new"
              element={<InvoiceWizard />}
            />
          </Route>
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
