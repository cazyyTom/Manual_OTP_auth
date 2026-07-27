import  ApiError  from "../utils/ApiError.js";

// Express identifies this as error-handling middleware purely by its
// parameter count (4 args: err, req, res, next) — that arity is what makes
// Express route errors here instead of treating it as ordinary middleware.
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // ── 1. MongoDB duplicate key — check FIRST, before generic normalisation ──
  // Most specific signal available, so it has to be checked before anything
  // broader would misclassify it.
  if (err.code === 11000) {
    const rawField = Object.keys(err.keyValue || {})[0]; // e.g. "email" or "address.city"
    const cleanField = rawField ? rawField.split(".")[0] : "Field";
    const message = `${cleanField.charAt(0).toUpperCase() + cleanField.slice(1)} is already taken.`;
    error = new ApiError(409, message, err.stack);
  }

  // ── 2. Normalise everything else that isn't already our own ApiError ─────
  else if (!(error instanceof ApiError)) {
    const isValidationError = error.name === "ValidationError";
    const statusCode = error.statusCode || (isValidationError ? 400 : 500);

    // Only trust the original error's message for errors we've actually
    // recognized (a validation error safely describes bad input, not
    // internals). Anything that fell through to 500 is unclassified — never
    // forward its raw message to the client, since we don't know what it
    // contains. Log the real thing for yourself instead.
    let message;
    if (isValidationError) {
      message = error.message;
    } else if (statusCode === 500) {
      console.error(err);
      message = "Something went wrong";
    } else {
      message = error.message || "Something went wrong";
    }

    error = new ApiError(statusCode, message, err.stack, error?.errors || []);
  }

  // ── 3. Send response ───────────────────────────────────────────────────
  // Every branch above funnels into this same shape, regardless of source —
  // that's the entire point of normalizing first.
  const response = {
    statusCode: error.statusCode,
    message: error.message,
    success: false,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};
