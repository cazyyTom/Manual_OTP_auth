// src/pages/DashboardPage.jsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    // logout() only clears local state — it doesn't redirect. Navigating
    // is this page's job, not AuthContext's, same reasoning as errors
    navigate("/login");
  };

  return (
    <div>
      <h1>Dashboard</h1>
      {/* user is guaranteed non-null here — ProtectedRoute already
          checked that before this component ever rendered */}
      <p>Welcome, {user.username}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
