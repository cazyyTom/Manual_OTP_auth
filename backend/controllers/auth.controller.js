// Mention all the imports
import crypto from "crypto";
import jwt from "jsonwebtoken";
import  asyncHandler  from "../utils/AsyncHandler.js";
import  ApiResponse  from "../utils/ApiResponse.js";
import  ApiError  from "../utils/ApiError.js";
import { generateAccessAndRefreshTokens } from "../utils/generateToken.js";
import { User } from "../models/auth.model.js";
import {
  cookieOption,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  OTP_RESEND_INTERVAL,
  OTP_RESEND_MAX_ATTEMPTS,
  OTP_RESEND_WINDOW,
} from "../config/constants.js";
import {
  sendEmail,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
} from "../utils/mailer.js";

//--------------Register user----------------------
export const registerUser = asyncHandler(async (req, res) => {
  // Extraction
  const { username, email, password } = req.body;

  // Guard clause: does the user already exist?
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new ApiError(409, "User with this email/username already exist");
  }

  // Core action: create the user. Password hashing happens in the pre-save hook.
  const user = new User({ email, username, password });

  // Generate OTP (hashed version stored on the doc, plain version returned)
  const otp = user.generateOtp("email_verification");
  await user.save();

  // Side effect: email the PLAIN otp — never the hash
  await sendEmail({
    email: user.email,
    ...verificationEmailTemplate(user.username, otp),
  });

  // Re-fetch so select:false fields are guaranteed excluded from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationOtp -forgotPasswordOtp",
  );

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: createdUser },
        "User created successfully, please check your email for OTP",
      ),
    );
});

//-----------------Verify Email-------------------
export const verifyEmail = asyncHandler(async (req, res) => {
  // Extraction
  const { email, otp } = req.body;
  if (!email || !otp) throw new ApiError(400, "Please provide email and otp");

  // Guard clause: need both otp fields to verify against — select() takes a
  // single space-separated string, not multiple arguments
  const user = await User.findOne({ email }).select(
    "+emailVerificationOtp +emailVerificationOtpExpires",
  );

  // Guard clause: user exists
  if (!user) throw new ApiError(400, "User not found");

  // Guard clause: already verified
  if (user.isEmailVerified) throw new ApiError(400, "Email already verified");

  // Guard clause: was an OTP even requested?
  if (!user.emailVerificationOtp || !user.emailVerificationOtpExpires)
    throw new ApiError(400, "No OTP requested, Kindly request new one");

  // Guard clause: expiry
  if (user.emailVerificationOtpExpires < Date.now())
    throw new ApiError(400, "OTP expired, Please request a newer OTP.");

  // Guard clause: hash-compare
  const incomingHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (incomingHash !== user.emailVerificationOtp)
    throw new ApiError(400, "Invalid OTP");

  // Core action: mark verified, clear the OTP immediately (single-use)
  user.isEmailVerified = true;
  user.emailVerificationOtp = null;
  user.emailVerificationOtpExpires = null;
  await user.save({ validateBeforeSave: false });

  // Re-fetch instead of returning the mutated instance — this doc still carries
  // the (now-null) otp fields since they were explicitly selected above; a fresh
  // query respects select:false again and gives a clean object
  const verifiedUser = await User.findById(user._id);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: verifiedUser },
        "Email verified successfully",
      ),
    );
});

//-----------------Login User-------------------
export const loginUser = asyncHandler(async (req, res) => {
  // Extraction
  const { email, password } = req.body;

  // Guard clause: both fields provided
  if (!email || !password)
    throw new ApiError(400, "Please provide email and password");

  // Guard clause: user exists — need +password to compare against
  const user = await User.findOne({ email }).select("+password");
  if (!user)
    throw new ApiError(
      400,
      "Invalid Credentials, Kindly check your email and password",
    );

  // Guard clause: password correct — same message/status as "user not found"
  // above, so a bad actor can't tell which case failed (prevents account enumeration)
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid)
    throw new ApiError(
      400,
      "Invalid Credentials, Kindly check your email and password",
    );

  // Guard clause: only reveal verification status once credentials are already
  // proven correct — safe to be specific now, since they've shown they own this account
  if (!user.isEmailVerified) {
    throw new ApiError(
      400,
      "Kindly, first verify your email than try to login",
    );
  }

  // Core action: issue a fresh token pair
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  // Re-fetch so select:false fields are guaranteed excluded from the response
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationOtp -forgotPasswordOtp",
  );

  // Core action: set the refresh token in a cookie, return the access token in the response
  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOption,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOption,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser },
        "User logged in successfully",
      ),
    );
});

//-----------------Resend OTP-------------------
export const resendEmailVerificationOtp = asyncHandler(async (req, res) => {
  // Extraction
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Please provide an email.");

  // Guard clause: user exists — need both resend-tracking fields, each with its own "+"
  const user = await User.findOne({ email }).select(
    "+emailVerificationOtpLastSentAt +emailVerificationOtpResendCount",
  );
  if (!user) throw new ApiError(400, "User not found");

  // Guard clause: no point resending a verification OTP for an already-verified email
  if (user.isEmailVerified) throw new ApiError(409, "Email already Verified");

  const now = Date.now();
  const lastSentAt = user.emailVerificationOtpLastSentAt
    ? user.emailVerificationOtpLastSentAt.getTime()
    : null;

  // Rolling window: if it's been longer than the window since the last send,
  // the count resets — this is what stops a permanent lockout after 5 sends ever.
  if (lastSentAt && now - lastSentAt > OTP_RESEND_WINDOW) {
    user.emailVerificationOtpResendCount = 0;
  }

  // Guard clause: max resends within the current window
  if (user.emailVerificationOtpResendCount >= OTP_RESEND_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "Maximum resend attempts exceeded. Please try again later.",
    );
  }

  // Guard clause: minimum gap between two consecutive resends
  if (lastSentAt && now - lastSentAt < OTP_RESEND_INTERVAL) {
    const waitSeconds = Math.ceil(
      (OTP_RESEND_INTERVAL - (now - lastSentAt)) / 1000,
    );
    throw new ApiError(
      429,
      `Please wait for ${waitSeconds}s to request another OTP`,
    );
  }

  // Core action: generate a new OTP, track when it was sent and how many times
  const otp = user.generateOtp("email_verification");
  user.emailVerificationOtpLastSentAt = new Date(now);
  user.emailVerificationOtpResendCount += 1;
  await user.save({ validateBeforeSave: false });

  // Side effect: email the PLAIN otp — never the hash
  await sendEmail({
    email: user.email,
    ...verificationEmailTemplate(user.username, otp),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "OTP resent successfully"));
});

//------------Forgot Password-----------------------
export const forgotPassword = asyncHandler(async (req, res) => {
  // Extraction
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Please provide an email.");

  // Guard clause: user exists — need both resend-tracking fields
  const user = await User.findOne({ email }).select(
    "+forgotPasswordOtpLastSentAt +forgotPasswordOtpResendCount",
  );
  if (!user) throw new ApiError(400, "User not found");

  // Guard clause: must verify email before password-reset flow is allowed
  if (!user.isEmailVerified) {
    throw new ApiError(
      400,
      "Please verify your email before resetting your password",
    );
  }

  const now = Date.now();
  const lastSentAt = user.forgotPasswordOtpLastSentAt
    ? user.forgotPasswordOtpLastSentAt.getTime()
    : null;

  // Rolling window: same principle as resendEmailVerificationOtp — resets the
  // count once the window has passed, so this can't become a permanent lockout
  if (lastSentAt && now - lastSentAt > OTP_RESEND_WINDOW) {
    user.forgotPasswordOtpResendCount = 0;
  }

  // Guard clause: max resends within the current window
  if (user.forgotPasswordOtpResendCount >= OTP_RESEND_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "Maximum resend attempts exceeded. Please try again later.",
    );
  }

  // Guard clause: minimum gap between two consecutive resends
  if (lastSentAt && now - lastSentAt < OTP_RESEND_INTERVAL) {
    const waitSeconds = Math.ceil(
      (OTP_RESEND_INTERVAL - (now - lastSentAt)) / 1000,
    );
    throw new ApiError(
      429,
      `Please wait for ${waitSeconds}s to request another OTP`,
    );
  }

  // Core action: generate the forgot-password OTP, track send time and count
  const otp = user.generateOtp("forgot_password");
  user.forgotPasswordOtpLastSentAt = new Date(now);
  user.forgotPasswordOtpResendCount += 1;
  await user.save({ validateBeforeSave: false });

  // Side effect: email the PLAIN otp — never the hash
  await sendEmail({
    email: user.email,
    ...passwordResetEmailTemplate(user.username, otp),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Reset Password OTP sent successfully"));
});

//------------Verify Forgot Password OTP-----------------------
export const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  // Extraction
  const { email, otp } = req.body;
  if (!email || !otp) throw new ApiError(400, "Please provide email and otp");

  // Guard clause: need the otp fields to verify against
  const user = await User.findOne({ email }).select(
    "+forgotPasswordOtp +forgotPasswordOtpExpires",
  );
  if (!user) throw new ApiError(400, "Invalid OTP or email");

  // Guard clause: was an OTP even requested?
  if (!user.forgotPasswordOtp || !user.forgotPasswordOtpExpires) {
    throw new ApiError(400, "Please request a password reset OTP first");
  }

  // Guard clause: expiry
  if (user.forgotPasswordOtpExpires < Date.now()) {
    throw new ApiError(400, "OTP has expired. Please request a new one");
  }

  // Guard clause: hash-compare
  const incomingHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (incomingHash !== user.forgotPasswordOtp) {
    throw new ApiError(400, "Invalid OTP");
  }

  // OTP is single-use — it's been proven, clear it now so it can't be replayed
  // on this endpoint again even within its expiry window.
  user.forgotPasswordOtp = null;
  user.forgotPasswordOtpExpires = null;
  await user.save({ validateBeforeSave: false });

  // Core action: issue a short-lived, purpose-specific token as proof of this
  // verification. Separate secret from access/refresh tokens — a leaked
  // access-token secret should never let someone forge a password-reset pass.
  const resetToken = jwt.sign(
    { _id: user._id },
    process.env.RESET_TOKEN_SECRET,
    {
      expiresIn: "10m",
    },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { resetToken }, "OTP verified successfully"));
});

//------------Reset Password (using resetToken, not otp)-----------------------
export const resetPassword = asyncHandler(async (req, res) => {
  // Extraction — no email, no otp. The token already carries proof of both.
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    throw new ApiError(400, "Please provide resetToken and new password");
  }

  // Core action: verify signature + expiry, converted to a controlled ApiError
  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.RESET_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(
      401,
      "Invalid or expired reset token. Please request a new OTP",
    );
  }

  // Guard clause: user must still exist, need +password to overwrite it
  const user = await User.findById(decoded._id).select("+password");
  if (!user) throw new ApiError(400, "User not found");

  // Core action: pre-save hook re-hashes it. No validateBeforeSave:false —
  // we WANT the minlength validator to run against the new password.
  user.password = newPassword;

  // Rotate refresh token — a stolen session from before the reset must die
  user.refreshToken = undefined;

  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset successfully. Please log in again.",
      ),
    );
});

//------------Refresh Access Token-----------------------
export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Extraction — comes from the cookie, never the body (client can't read httpOnly cookies anyway)
  const incomingRefreshToken = req.cookies?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request — no refresh token provided");
  }

  // Core action: verify signature + expiry. jwt.verify throws synchronously on
  // failure — caught here and converted to a controlled ApiError instead of
  // leaking jwt's raw error shape to the client.
  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Guard clause: user must still exist, need +refreshToken to compare against
  const user = await User.findById(decoded._id).select("+refreshToken");
  if (!user) throw new ApiError(401, "Invalid refresh token");

  // Guard clause: the incoming token must match what's stored in the DB.
  // This is the step that actually revokes access — jwt.verify alone would
  // still call an old, already-rotated-out token "valid" since its signature
  // and expiry are both fine on their own.
  if (incomingRefreshToken !== user.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or has been used");
  }

  // Core action: issue a fresh pair, overwrite the stored token (rotation)
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, {
      ...cookieOption,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    .cookie("refreshToken", refreshToken, {
      ...cookieOption,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })
    .json(new ApiResponse(200, {}, "Access token refreshed successfully"));
});

//------------Logout User-----------------------
export const logoutUser = asyncHandler(async (req, res) => {
  // req.user is attached by your auth middleware (verifyJWT) — this route
  // must sit behind that middleware, since logout only makes sense for a
  // request that's already proven who it is.

  // Core action: findByIdAndUpdate + $unset instead of fetch-then-save —
  // one DB round trip, and it skips re-running the whole document's
  // validation/hooks for a change this small.
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  // Side effect: clearCookie is the correct tool here, not setting an empty
  // value — it sends the right Set-Cookie header to actually remove it from
  // the browser rather than just emptying it.
  return res
    .status(200)
    .clearCookie("accessToken", cookieOption)
    .clearCookie("refreshToken", cookieOption)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

//------------Change Current Password-----------------------
export const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Extraction
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Please provide old and new password");
  }

  // req.user comes from auth middleware — requires an active session
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  // Guard clause: prove they know the CURRENT password before allowing a change —
  // otherwise anyone with a hijacked access token could lock the real owner out
  const isOldPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isOldPasswordValid) throw new ApiError(400, "Old password is incorrect");

  // Core action: pre-save hook re-hashes it
  user.password = newPassword;

  // Rotate refresh token — forces every other active session to log in again
  user.refreshToken = undefined;

  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});
