import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// This component renders NO UI of its own — it's a gatekeeper. React
// Router v6's pattern for this is: wrap a group of routes in one
// <Route element={<ProtectedRoute />}> and each child route renders in
// place of <Outlet /> below, only if this component decides to render it.
export default function ProtectedRoute() {
  // Reads the same `user` state AuthProvider set on login/logout —
  // this is the single source of truth for "is anyone logged in"
  const { user } = useAuth();

  // Guard clause: no user in context means either nobody logged in,
  // or the page was hard-refreshed (remember: no /me endpoint yet, so
  // refresh always resets `user` to null even if the cookie is still valid)
  if (!user) {
    // `replace` swaps the current history entry instead of pushing a new
    // one — so hitting the browser's back button from /login doesn't
    // bounce the user right back into the protected page it just kicked
    // them out of
    return <Navigate to="/login" replace />;
  }

  // Outlet is React Router's placeholder for "whichever child route
  // matched." It's what lets ONE ProtectedRoute guard MANY pages, instead
  // of writing this same if/else inside every protected page individually
  return <Outlet />;
}
