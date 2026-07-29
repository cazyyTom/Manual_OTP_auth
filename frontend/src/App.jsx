import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  return (
    <Routes>
      {/* "/" itself isn't a real page — send it straight to login instead
          of rendering nothing (no <Route path="/"> would match otherwise) */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public routes — reachable regardless of login state, no guard */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Nested under ProtectedRoute: it renders its child via <Outlet />
          only if useAuth().user exists, else redirects to /login. Any
          route placed inside this block inherits that same check — this
          is the payoff of using Outlet over wrapping each page manually */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>

      {/* Catch-all for any URL that matched nothing above. Must be LAST —
          React Router checks routes top to bottom, and "*" matches
          everything, so higher up it would swallow every other route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
