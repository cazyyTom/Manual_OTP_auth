import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ChangePasswordPage() {
  // Sending "oldPassword" because that's the field name the CONTROLLER
  // actually reads (changeCurrentPassword destructures oldPassword).
  // changePasswordValidator checks a field called "currentPassword"
  // instead — so right now validation is silently checking a field that
  // never arrives, meaning a missing old password won't get caught by
  // the validator. Worth fixing on the backend (rename one side to
  // match the other) — flagging it here so it's not a mystery later.
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-only check, same reasoning as ResetPasswordPage — saves a
    // round trip on an obvious typo, backend never sees confirmPassword
    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Protected route — no token attached manually here. The browser
      // sends the accessToken cookie automatically (withCredentials was
      // set once in axiosClient). If that cookie happens to be expired,
      // the interceptor we just added retries this call automatically
      // after a silent refresh — this page doesn't need to know or care.
      await api.post("/change-password", {
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      });

      // The backend invalidates the stored refreshToken on a password
      // change (kills every other active session too) but never clears
      // THIS session's cookies or issues new ones. Left alone, this tab
      // would keep working for up to 15 more minutes on the still-valid
      // access token, then fail once it expires with nothing valid to
      // refresh against. Logging out explicitly now keeps the client
      // state honest about what the backend already did server-side.
      await logout();
      navigate("/login", {
        state: { message: "Password changed. Please log in again." },
      });
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
            <Lock className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-800">
          Change password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type={showPassword ? "text" : "password"}
              name="oldPassword"
              placeholder="Current password"
              value={formData.oldPassword}
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
              name="newPassword"
              placeholder="New password"
              value={formData.newPassword}
              onChange={handleChange}
              required
              className="rounded-full bg-gray-100 border-none pl-10"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm new password"
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
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
