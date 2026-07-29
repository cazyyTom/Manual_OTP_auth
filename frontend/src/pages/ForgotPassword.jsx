// src/pages/ForgotPasswordPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState({ email: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/forgot-password", { email: formData.email });

      // Nothing useful in the response to store — we only need to carry
      // the email itself forward, so the next page knows who the OTP
      // belongs to without asking again
      navigate("/reset-password", { state: { email: formData.email } });
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
            <KeyRound className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold text-gray-800">
          Forgot password
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Enter your email and we'll send you a reset code
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
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
            {loading ? "Sending..." : "Send reset code"}
          </Button>
        </form>

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
