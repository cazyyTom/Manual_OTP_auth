// src/pages/ResetPasswordPage.jsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, KeyRound, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email;

  // Flow state — which screen within this one page is showing
  const [step, setStep] = useState("otp"); // "otp" | "password"

  // Held only in memory. Never written to localStorage/sessionStorage
  // and never put in the URL — it's a live credential for 10 minutes
  const [resetToken, setResetToken] = useState("");

  const [formData, setFormData] = useState({
    email: emailFromState || "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/verify-forgot-password-otp", {
        email: formData.email,
        otp: formData.otp,
      });
      setResetToken(res.data.data.resetToken);
      setStep("password"); // swaps which form renders below, same page
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Client-only check — backend never sees confirmPassword at all,
    // this purely saves a round trip on an obvious typo
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/reset-password", {
        resetToken,
        newPassword: formData.newPassword,
      });
      // Backend rotates refreshToken on reset, so any existing session
      // is already dead server-side — sending them to login, not
      // dashboard, is the only correct destination here
      navigate("/login");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-500 p-4">
      <Card className="relative w-full max-w-sm rounded-[2.5rem] border-none pt-16 pb-10 px-8 shadow-2xl">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500">
            {step === "otp" ? (
              <KeyRound className="h-7 w-7 text-white" />
            ) : (
              <Lock className="h-7 w-7 text-white" />
            )}
          </div>
        </div>

        {step === "otp" ? (
          <>
            <h1 className="mb-2 text-center text-2xl font-semibold text-gray-800">
              Enter reset code
            </h1>
            <p className="mb-6 text-center text-sm text-gray-500">
              Check your email for the 6-digit code
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={Boolean(emailFromState)}
                className="rounded-full bg-gray-100 border-none disabled:opacity-70"
              />
              <Input
                type="text"
                name="otp"
                placeholder="6-digit code"
                value={formData.otp}
                onChange={handleChange}
                required
                inputMode="numeric"
                maxLength={6}
                className="rounded-full bg-gray-100 border-none text-center tracking-widest"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90"
              >
                {loading ? "Verifying..." : "Verify code"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-center text-2xl font-semibold text-gray-800">
              Set new password
            </h1>
            <p className="mb-6 text-center text-sm text-gray-500">
              Choose a new password for your account
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  placeholder="New password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  className="rounded-full bg-gray-100 border-none pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="rounded-full bg-gray-100 border-none pl-10"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90"
              >
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          <Link
            to="/login"
            className="text-purple-600 font-medium hover:underline"
          >
            Back to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
