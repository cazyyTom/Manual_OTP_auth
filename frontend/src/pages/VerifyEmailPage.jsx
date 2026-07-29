// src/pages/VerifyEmailPage.jsx
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // If RegisterPage sent state, use that email and don't let it be edited.
  // Otherwise start blank and let the user type it in themselves.
  const emailFromRegister = location.state?.email;

  const [formData, setFormData] = useState({
    email: emailFromRegister || "",
    otp: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Starts at 60 on mount, not 0 — if they just registered, an OTP was
  // already sent within the last few seconds, so resend genuinely
  // shouldn't be available immediately. Purely a UX nicety; the backend
  // enforces the real rule regardless of what this shows.
  const [cooldown, setCooldown] = useState(60);

  // Self-resetting countdown: each tick schedules the next one, and
  // stops scheduling once it hits 0. Cleanup (return () => clearTimeout)
  // matters here — without it, navigating away mid-countdown would leave
  // a timer trying to update state on an unmounted component.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/verify-email", {
        email: formData.email,
        otp: formData.otp,
      });
      // Verified, but NOT logged in — cookies were never set by this
      // endpoint. So the only correct next step is the login page.
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

  const handleResend = async () => {
    setError("");
    setResendLoading(true);
    try {
      await api.post("/resend-email-verification", { email: formData.email });
      setCooldown(60);
    } catch (err) {
      // This is where the 429 "Please wait for Xs..." message actually
      // surfaces if they somehow bypass the disabled button
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-500 p-4">
      <Card className="relative w-full max-w-sm rounded-[2.5rem] border-none pt-16 pb-10 px-8 shadow-2xl">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-800">
          Verify your email
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Enter the 6-digit code we sent you
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={Boolean(emailFromRegister)}
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
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendLoading}
            className="text-purple-600 font-medium hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resendLoading
                ? "Sending..."
                : "Resend code"}
          </button>
        </div>

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
