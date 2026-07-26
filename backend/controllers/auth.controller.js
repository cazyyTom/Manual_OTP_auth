// Mention all the imports
import crypto from "crypto";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {generateAccessAndRefreshTokens} from "../utils/generateTokens.js"
import { User } from "../models/auth.model.js";
import {
  cookieOption,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE, OTP_RESEND_INTERVAL, OTP_RESEND_MAX_ATTEMPTS, OTP_RESEND_WINDOW
} from "../config/constants.js";
import {
  sendEmail,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
} from "../utils/mailer.js";

//--------------Register user----------------------

export const registerUser =
  /*Must wrapped in asyncHandler*/
  asyncHandler(async (req, res) => {
    /*Extract the user input*/
    const { username, email, password } = req.body;
    //Guard clause to check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      throw new ApiError(409, "User with this email/username already exist");
    }
    //Core action to save the user details
    const user = new User({ email, username, password });
    //Generate OTP(Hashed version store, plain to send)
    const otp = user.generateOtp("email_verification");
    await user.save();
    //Side Effect(Send mail)
    await sendEmail({
      email: user.email,
      ...verificationEmailTemplate(user.username, otp),
    });
    //Refetch so that we can remove all fields with select false from the response
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
  //grab details from user input
  const { email, otp } = req.body;
  //Check if user exists and grab hashed otp to compare
  const user = await User.findOne({ email }).select(
    "+emailVerificationOtp",
    "+emailVerificationOtpExpires",
  );
  //Guard clause for user
  if (!user) throw new ApiError(400, "User not found");
  //Guard Clause for Email Verified
  if (user.isEmailVerified) throw new ApiError(400, "Email already verified");
  //Guard clause if otp existed
  if (!user.emailVerificationOtp || !user.emailVerificationOtpExpires)
    throw new ApiError(400, "No OTP requested, Kindly request new one");
  //Guard clause if Otp expires
  if (user.emailVerificationOtpExpires < Date.now())
    throw new ApiError(400, "Otpexpired, Please request a newer Otp.");
  //Compare hashed otp with entered otp
  const incomingHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (incomingHash !== user.emailVerificationOtp)
    throw new ApiError(400, "Invalid OTP");
  //Core action to update user email verification status && Clear the used OTP
  user.isEmailVerified = true;
  user.emailVerificationOtp = null;
  user.emailVerificationOtpExpires = null;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Email verified successfully"));
});

//-----------------Login User-------------------
// Extract data from user input
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  //Guard clause if input provide
  if (!email || !password)
    throw new ApiError(400, "Please provide email and password");
  //Guard clause if user exist
  const user = await User.findOne({ email }).select("+password");
  if (!user)
    throw new ApiError(
      400,
      "Invalid Credentials, Kindly check your email and password",
    );

  //Check if password correct
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid)
    throw new ApiError(
      400,
      "Invalid Credentials, Kindly check your email and password",
    );

  //Guard Clause if email already registered then only login, else verify first
  if (!user.isEmailVerified) {
    throw new ApiError(
      400,
      "Kindly, first verify your email than try to login",
    );
  }

  //if correct details generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationOtp -forgotPasswordOtp",
  );
  //Core action to send the refresh token in cookie and access token in response
  res
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
})

  //-----------------Resend OTP-------------------
export const resendEmailVerificationOtp = asyncHandler(async (req, res)=> {
  //extraction
  const { email } = req.body;
  if (!email) throw new ApiError("Please provide an email.");
  //Gurard clause if user exist
  const user = await User.findById(user._id).select(
    "+emailVerificationOtpLastSentAt emailVerificationOtpResendCount",
  );
  if (!user) throw new ApiError(400, "User not found");

  //Guard clause if user already verified
  if (isEmailVerified) throw new ApiError(409, "Email already Verified");

  //Last Sent interval
  const now = Date.now();
  const lastSentAt = user.emailVerificationOtpLastSentAt
    ? user.emailVerificationOtpLastSentAt.getTime()
    : null;
  // Rolling window: if it's been longer than the window since the last send,
  // the count resets — this is what stops a permanent lockout after 5 sends ever.
if(lastSentAt && now - lastSentAt > OTP_RESEND_WINDOW){
    user.emailVerificationOtpResendCount = 0;
}
// Guard clause if resend count exceeded
if (user.emailVerificationOtpResendCount >= OTP_RESEND_MAX_ATTEMPTS) {
    throw new ApiError(
      429,
      "Maximum resend attempts exceeded. Please try again later.",
    );
  }
  //Guard clasue if another resend is attempted before the interval has passed
  if( lastSentAt &&  Date.now() - lastSentAt < OTP_RESEND_INTERVAL){
    const waitSeconds = Math.ceil(OTP_RESEND_INTERVAL - (now - lastSentAt))
    throw new ApiError(429, `Please wait fro ${waitSeconde} to request another OTP`)
  }
const opt = await user.generateOtp("email_verification")
user.emailVerificationOtpLastSentAt = Date.now();
user.emailVerificationOtpResendCount += 1;
await user.save({validateBeforeSave: false})

//Send the opt 
await sendEmail({
    email: user.email,
    ...verificationEmailTemplate(user.username, otp)
})
return res.status(200)
.nson(new ApiResponse(200, {}, "OTP rresent successfu;"))
})
