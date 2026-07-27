import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import  authRouter  from "./routes/auth.routes.js";
import  ApiError  from "./utils/ApiError.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

// ---- Global middlewares (order matters — these run on EVERY request) ----

// Parse incoming JSON bodies into req.body — without this, req.body is undefined
// in every controller. limit caps payload size as a basic DoS guard.
app.use(express.json({ limit: "16kb" }));

// Parse URL-encoded form bodies (traditional HTML form submissions)
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Parse the Cookie header into req.cookies — required for reading
// accessToken/refreshToken in verifyJWT and refreshAccessToken
app.use(cookieParser());

// CORS must come before routes. credentials:true is required for cookies to
// travel cross-origin; origin must be an explicit URL (not "*") once
// credentials are involved, or the browser silently drops the cookie.
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

// ---- Health check ----
// Deliberately no DB call here — this answers "is the server process up",
// independent of DB health. A separate /health/db check would be a different concern.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ---- Routes ----
// Mounted with a versioned prefix here, not inside the router — authRouter
// only ever knows "/login", "/register", etc, so the prefix can change
// without touching route definitions.
app.use("/api/v1/auth", authRouter);

// ---- 404 handler ----
// Catches anything that didn't match a route above. Must come AFTER every
// real route/router, or it would swallow requests meant for them.
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// ---- Global error handler ----
// Must be registered LAST — every asyncHandler's caught error and every
// thrown ApiError across the whole app (including the 404 above) funnels
// through next(err) and lands here, exactly once.
app.use(errorHandler);

export { app };
