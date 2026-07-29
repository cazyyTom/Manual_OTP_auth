import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* BrowserRouter has to be the OUTERMOST of these two — it sets up
        the routing context. AuthProvider goes inside it (not outside)
        because later on, login() will likely want to call useNavigate()
        to redirect somewhere after a successful login — and hooks like
        useNavigate only work on components rendered INSIDE a Router */}
    <BrowserRouter>
      <AuthProvider>
        {/* App is everything below this point — every page, and
            ProtectedRoute, all live inside App and can therefore both
            read the route (via Router) and read auth state (via
            AuthProvider) */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
