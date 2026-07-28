import {Router} from 'express';
import {verifyJWT} from "../middlewares/auth.middleware.js";
import {
  loginUser,
  logoutUser,
  registerUser,
  verifyEmail,
  resendEmailVerificationOtp,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  refreshAccessToken,
  changeCurrentPassword,
} from "../controllers/auth.controller.js";
import { healthCheck } from "../controllers/healthchecker.controller.js";
import { OTP_RESEND_INTERVAL, OTP_RESEND_MAX_ATTEMPTS, OTP_RESEND_WINDOW } from "../config/constants.js";
import { validate } from "../validators/validate.js";
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  changePasswordValidator,
  resetPasswordValidator,
} from "../validators/auth.validator.js";

const router = Router();

// Public routes
router.post("/register", registerValidator, validate, registerUser);
router.post("/login", loginValidator, validate, loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/verify-email/", verifyEmail);
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validate,
  forgotPassword,
);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);
router.post(
  "/reset-password/",
  resetPasswordValidator,
  validate,
  resetPassword,
);
router.post("/resend-email-verification", resendEmailVerificationOtp);
router.get("/health/db", healthCheck);

// Protected routes
router.use(verifyJWT);
router.post("/logout", logoutUser);
router.post(
  "/change-password",
  changePasswordValidator,
  validate,
  changeCurrentPassword,
);


export default router;
