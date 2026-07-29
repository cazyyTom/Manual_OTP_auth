import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  // Controlled inputs: React state IS the source of truth for what's in
  // each field, not the DOM. One object instead of two separate useState
  // calls, since these two fields always update and submit together.
  const [formData, setFormData] = useState({ email: "", password: "" });
  // Holds a message to show the user when login fails — separate from
  // AuthContext's `loading`, because this is purely this page's own UI
  // concern (what to display), not shared auth state
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false); // new: toggles the eye icon

  const { login, loading } = useAuth();
  const navigate = useNavigate();
  // One handler for both inputs, keyed by the input's `name` attribute —
  // avoids writing a near-identical handleEmailChange/handlePasswordChange
  // pair that would just duplicate this same logic twice
  const location = useLocation();
  const successMessage = location.state?.message;

  const handleChange = (e) => {
    
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    // Forms reload the page on submit by default — this is the line that
    // stops that, since we're handling submission with JS instead
    e.preventDefault();
    // Clear any error from a previous failed attempt before trying again,
    // so a stale message doesn't linger if this attempt takes a moment
    setError("");
    try {
      // login() is defined in AuthContext — it calls the backend and,
      // on success, sets `user` in context. We don't need that return
      // value here; we just need to know it didn't throw.
      await login(formData.email, formData.password);
      // Only reached if login() did NOT throw — i.e. credentials were
      // valid AND the email was already verified
      navigate("/dashboard");
    } catch (err) {
      // Axios throws on any non-2xx response. Your backend's errorHandler
      // always sends { statusCode, message, success: false, ... } as the
      // JSON body — err.response.data is that body, so .message is the
      // actual reason ("Invalid Credentials...", "first verify your
      // email...", etc). The ?. guards against a network failure, where
      // there's no err.response at all (server unreachable, CORS, etc).
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    }
  };

  return (
    // Full-screen gradient backdrop, centers the card both ways at any
    // screen size — this outer div is what the reference image's purple/
    // blue background is doing
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-500 p-4">
      {/* relative + pt-16: leaves room at the top for the avatar circle,
          which is positioned absolutely and overlaps the card's top edge */}
      <Card className="relative w-full max-w-sm rounded-[2.5rem] border-none pt-16 pb-10 px-8 shadow-2xl">
        {/* Avatar circle — sits half outside, half inside the card.
            -translate-x-1/2 on a left-1/2 element is the standard trick
            for horizontally centering something of unknown width */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-500">
            <User className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mb-6 text-center text-2xl font-semibold text-gray-800">
          Sign in
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* relative wrapper lets the icon sit INSIDE the input's left
              edge via absolute positioning, instead of a separate element
              next to it */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="rounded-full bg-gray-100 border-none pl-10 pr-10"
            />
            {/* type="button" is important here — inside a <form>, a
                button with no type defaults to type="submit", which
                would submit the form every time someone just wants to
                toggle password visibility */}
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

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-gray-600 font-normal">
                Remember me
              </Label>
            </div>
            <Link
              to="/forgot-password"
              className="text-purple-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {successMessage && (
            <p className="mb-4 text-center text-sm text-green-600">
              {successMessage}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-purple-600 font-medium hover:underline"
          >
            Sign up!
          </Link>
        </p>
      </Card>
    </div>
  );
}
