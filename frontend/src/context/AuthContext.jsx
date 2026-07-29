import { createContext, useContext, useState } from "react";
import api from "../api/axiosClient";

// Context object — just a shared "box" that any descendant component can
// read from, without it being passed down as a prop through every layer
// in between. Created once at module load, not inside the component.
const AuthContext = createContext();

// Naming note: AuthProvider and AuthContext are capitalized (PascalCase)
// on purpose, NOT camelCase — this isn't optional style, it's how React
// tells components apart from plain HTML tags. JSX treats a lowercase
// tag like <authProvider> as a literal DOM element (like <div>), and
// would silently fail to render your component. Every component name
// (and the Context object itself) stays PascalCase. Regular functions
// and variables below (login, register, logout, useAuth, user, loading)
// are camelCase, same as any normal JS function.
export function AuthProvider({ children }) {
  // ---- State ----

  // The logged-in user's info (username/email/etc), or null if nobody's
  // logged in. This single value IS your "is authenticated" check —
  // there's no separate isLoggedIn flag, because user/null already
  // encodes that; a second flag would just be a second source of truth
  // that could drift out of sync with this one.
  const [user, setUser] = useState(null);

  // True while a login/register/logout request is in flight. Exists so
  // pages can disable their submit button or show a spinner, without
  // each page reinventing its own local "isSubmitting" state.
  const [loading, setLoading] = useState(false);

  // ---- Login ----
  const login = async (email, password) => {
    // Core action: kick off the request, flip loading on first
    setLoading(true);

    try {
      // api already carries baseURL + withCredentials, so this is just
      // POST {baseURL}/login — the browser attaches/stores cookies itself
      const res = await api.post("/login", { email, password });

      // Backend wraps every response as ApiResponse: { data: {...}, ... }
      // so res.data is axios's own wrapper, and res.data.data is the
      // {user} object your controller actually passed in
      setUser(res.data.data.user);
    } catch (err) {
      // Side effect we deliberately DON'T do here: show an error message.
      // AuthContext only owns auth *state* — deciding how to display a
      // failed-login message is the calling page's job. So we just
      // re-throw, and LoginPage's own try/catch handles the UI part.
      throw err;
    } finally {
      // Runs whether login succeeded or threw — always turn loading back off
      setLoading(false);
    }
  };

  // ---- Register ----
  const register = async (username, email, password) => {
    setLoading(true);
    try {
      const res = await api.post("/register", { username, email, password });

      // Guard-clause-equivalent thought, not code: we deliberately do NOT
      // call setUser() here. Your backend creates the account but leaves
      // isEmailVerified: false, and loginUser rejects unverified accounts
      // outright. So "registered" ≠ "logged in" — the real login only
      // happens later, after verify-email succeeds.
      return res.data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ---- Logout ----
  const logout = async () => {
    try {
      // Tells the backend to clear the httpOnly cookies + unset the
      // stored refreshToken on the user document
      await api.post("/logout");
    } catch (err) {
      // Intentionally empty: even if this request fails (e.g. network
      // drop), the user still clicked "log out" — the local UI should
      // treat them as logged out regardless of what the server did
    } finally {
      // Core action: this is the line that actually updates the UI —
      // everything reading `user` from useAuth() re-renders as logged-out
      setUser(null);
    }
  };

  // Everything exposed to the rest of the app through useAuth(). Pages
  // read `user`/`loading` to render conditionally, and call the three
  // functions directly — they never touch `api` or setUser themselves.
  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Small custom hook — lets pages write `const { user, login } = useAuth()`
// instead of importing both useContext and AuthContext everywhere. Also
// means if we ever change how the context is structured internally,
// only this one line needs to know about it.
export const useAuth = () => useContext(AuthContext);
