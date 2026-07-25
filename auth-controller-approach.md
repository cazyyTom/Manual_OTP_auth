# Auth Controller Design Framework — Manual OTP System

The goal here isn't to memorize this code. It's to internalize the *pattern* so you can
write any future auth endpoint (2FA, magic links, device verification, whatever) without
looking anything up.

---

## 1. The Universal Pattern

Every single auth controller function — no matter what it does — is the same 7 steps.
Once this is muscle memory, "writing an auth controller" stops being a research task.

```
1. Extract input        -> req.body/params (validators upstream already checked shape)
2. Fetch the user        -> decide which select(+fields) you need right now
3. Guard clauses         -> business rules, in an order that fails fast, leaks nothing extra
4. Core action            -> the actual crypto/db work (hash compare, otp compare, token sign)
5. Mutate & persist       -> update fields, save(), clear one-time-use fields immediately
6. Side effects           -> send email, set cookies
7. Respond                -> ApiResponse, never leak password/otp fields, even hashed
```

Every controller is `asyncHandler(async (req, res) => { ... })`. You never `return` an
`ApiError` — you `throw` it. asyncHandler's whole job is catching that throw and forwarding
it to your error middleware. `return new ApiError(...)` (bug #5 in your mailer util) just
hands back an error object as if it were valid data — nothing catches it.

---

## 2. Non-negotiable rules for an OTP system specifically

- **Hash the OTP before storing it**, same principle as password:
  `crypto.createHash("sha256").update(otp).digest("hex")`. Compare hash-to-hash on verify.
  Plaintext OTPs in the DB defeat the point of hashing anything else.
- **Check expiry explicitly**: `otpExpires && otpExpires > Date.now()`. Don't rely on
  presence alone — an OTP field can exist and still be stale.
- **Null out the OTP fields the moment they're used successfully.** This is what makes an
  OTP single-use. Skipping this = replay vulnerability.
- **Cap attempts.** A 6-digit OTP is 1,000,000 combinations — trivially brute-forceable
  without a limit. Add an `otpAttempts` counter, lock after ~5 tries, reset on new OTP issue.
- **Rate-limit the "send OTP" endpoints** at the route level (`express-rate-limit`), keyed by
  IP and by email. Otherwise anyone can email-bomb your users for free.
- **Cookie flags for tokens**:
  ```js
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };
  ```
- **Rotate the refresh token on password reset/change** — this is what actually logs out
  every other session. If you don't do this, a stolen refresh token survives a password reset.
- **Consider generic responses for login / forgot-password** ("if that account exists, an
  OTP was sent") to avoid confirming which emails are registered. Optional — your call, but
  know it's a deliberate tradeoff, not an oversight.

---

## 3. Fixes to apply to your existing files

**Model — hashed, DRY `generateOtp` (replace your current method):**
```js
import crypto from "crypto";

const OTP_FIELD_MAP = {
  email_verification: ["emailVerificationOtp", "emailVerificationOtpExpires"],
  forgot_password: ["forgotPasswordOtp", "forgotPasswordOtpExpires"],
  reset_password: ["resetPasswordOtp", "resetPasswordOtpExpires"],
};

userSchema.methods.generateOtp = function (purpose) {
  const fields = OTP_FIELD_MAP[purpose];
  if (!fields) throw new Error("Invalid OTP generation purpose specified");

  const otp = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  this[fields[0]] = hashedOtp;
  this[fields[1]] = expiryTime;

  return otp; // plain otp — only for emailing, never stored
};
```

**Model — fix method assignment and token signing:**
```js
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// jwt.sign is synchronous — drop the unnecessary async/await here
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, username: this.username, email: this.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
  });
};
```

**Model — add the missing field:**
```js
refreshToken: {
  type: String,
  select: false,
},
```

**Token util — throw, don't return; no await needed now that methods are sync:**
```js
export const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(400, "User not found");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};
```

**Mailer — default imports, correct method name:**
```js
import nodemailer from "nodemailer";
import Mailgen from "mailgen";

const transporter = nodemailer.createTransport({ ... });
```

---

## 4. Worked example #1 — `registerUser`

```js
import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/User.js";
import { sendEmail, verificationEmailTemplate } from "../utils/mailer.js";

export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Guard clause: does the user already exist?
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  // Core action: create the user. Password hashing happens in the pre-save hook.
  const user = new User({ username, email, password });

  // Generate OTP (hashed version stored on the doc, plain version returned)
  const otp = user.generateOtp("email_verification");
  await user.save();

  // Side effect: email the PLAIN otp — never the hash
  await sendEmail({
    email: user.email,
    ...verificationEmailTemplate(user.username, otp),
  });

  // Re-fetch so select:false fields are guaranteed excluded from the response
  const createdUser = await User.findById(user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered. OTP sent to email."));
});
```

## 5. Worked example #2 — `verifyEmailOtp`

```js
export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email }).select(
    "+emailVerificationOtp +emailVerificationOtpExpires"
  );
  if (!user) throw new ApiError(404, "User not found");

  if (user.isEmailVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  if (!user.emailVerificationOtp || !user.emailVerificationOtpExpires) {
    throw new ApiError(400, "No OTP requested. Please request a new one");
  }

  if (user.emailVerificationOtpExpires < Date.now()) {
    throw new ApiError(400, "OTP has expired. Please request a new one");
  }

  const incomingHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (incomingHash !== user.emailVerificationOtp) {
    throw new ApiError(400, "Invalid OTP");
  }

  // Success: flip the flag, clear the OTP immediately (single-use)
  user.isEmailVerified = true;
  user.emailVerificationOtp = null;
  user.emailVerificationOtpExpires = null;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Email verified successfully"));
});
```

**Notice steps 2-6 from the universal pattern are all visibly present in both examples.**
That's the thing to look for once you write your own — if a step is missing, ask why.

*Optional next refactor once these two work: pull the hash-compare-expiry logic (the middle
three checks in `verifyEmailOtp`) into a single model method `user.verifyOtp(otp, purpose)`
using the same `OTP_FIELD_MAP` idea as `generateOtp`. You'll reuse it 3 times (email verify,
forgot-password verify, reset-password verify) — don't copy-paste it three times.*

---

## 6. Build these yourself — spec sheet

No code here on purpose. Steps + the specific thing to get right, from the pattern above.

| Endpoint | Steps | Watch out for |
|---|---|---|
| **loginUser** | find user by email/username `+password` → compare password → (optionally) require `isEmailVerified` → `generateAccessAndRefreshTokens` → set cookies → respond with user (no password) + tokens | Use the *same* error message/status for "user not found" and "wrong password" — don't let one leak which case it was |
| **resendOtp** | find user → check not already verified (for email_verification) → `generateOtp(purpose)` → save → email | Add an `otpLastSentAt` field + minimum resend interval so this can't be spammed |
| **forgotPasswordRequestOtp** | find user by email → generate `forgot_password` OTP → save → email | If user isn't found, consider responding the same generic success message anyway |
| **resetPassword** | find user `+forgotPasswordOtp +forgotPasswordOtpExpires +password` → verify hash+expiry (same 3 checks as example #2) → set `user.password = newPassword` (pre-save hook re-hashes) → clear otp fields → **rotate refreshToken** → save | Forgetting to rotate refreshToken means a stolen session survives a password reset |
| **refreshAccessToken** | read refresh token from cookie → `jwt.verify` with `REFRESH_TOKEN_SECRET` → find user by `decoded._id` `+refreshToken` → **compare incoming token to `user.refreshToken` in DB** → issue new pair → set cookies | Skipping the DB comparison and trusting `jwt.verify` alone is a classic mistake — a valid-but-revoked token would still pass `jwt.verify` |
| **logoutUser** | (behind auth middleware) `User.findByIdAndUpdate(req.user._id, { refreshToken: undefined })` → clear cookies | Needs `req.user`, so this route sits behind your JWT-verify middleware |
| **changeCurrentPassword** | (behind auth middleware) find user `+password` → `isPasswordCorrect(oldPassword)` → set new password → save → optionally rotate refreshToken | Same "compare old password before allowing change" as any account security flow |

---

## 7. Pre-ship checklist — run this on every new auth endpoint

- [ ] Wrapped in `asyncHandler`, errors `throw`n as `ApiError`, never `return`ed
- [ ] Correct `.select("+field")` for anything that's `select: false`
- [ ] Guard clauses ordered so nothing leaks more than it has to
- [ ] Any OTP/token field is cleared immediately after successful use
- [ ] Response object never contains password or OTP fields, hashed or not
- [ ] Cookies use `httpOnly`, `secure` (prod), `sameSite`
- [ ] Route has rate limiting if it sends an email/OTP
- [ ] Tested: happy path, expired OTP, wrong OTP, reused OTP, missing user
