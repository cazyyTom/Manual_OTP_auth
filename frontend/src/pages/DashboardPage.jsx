import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-600 via-fuchsia-500 to-blue-500 p-4 text-white">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {/* user is guaranteed non-null — ProtectedRoute already checked
          before this component ever rendered */}
      <p>Welcome, {user.username}</p>
      <div className="flex gap-3">
        <Link
          to="/change-password"
          className="rounded-full bg-white/20 px-4 py-2 hover:bg-white/30"
        >
          Change password
        </Link>
        <button
          onClick={handleLogout}
          className="rounded-full bg-white/20 px-4 py-2 hover:bg-white/30"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
