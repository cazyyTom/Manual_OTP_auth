import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";

const userSchema = new Schema({
  username: {
    type: String,
    required: [true, "Please provide a username"],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: [8, "Password must be minimum 8 characters long"],
    select: false,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationOtp: {
    type: String,
    default: null,
    select: false,
  },
  emailVerificationOtpExpires: {
    type: Date,
    default: null,
    select: false,
  },
  forgotPasswordOtp: {
    type: String,
    default: null,
    select: false,
  },
  forgotPasswordOtpExpires: {
    type: Date,
    default: null,
    select: false,
  },
  resetPasswordOtp: {
    type: String,
    default: null,
    select: false,
  },
  resetPasswordOtpExpires: {
    type: Date,
    default: null,
    select: false,
  },
  
},
{timestamps: true}
);

//Lets hash password before save
userSchema.pre("save", async function(){
  if(!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare Hashed password with user password
userSchema.methods.isPasswordCorrect(
async function(password){
return await bcrypt.compare(password, this.password)
}
);

// Generate Access & Refresh token
userSchema.methods.generateAccessToken=
  async function () {
    return jwt.sign({_id:this.id, username:this.username, email:this.email},
      process.env.ACCESS_TOKEN_SECRET,
      {ExoiresIn: process.env.ACCESS_TOKEN_EXPIRY}
    )
  };


userSchema.methods.generateRefreshToken=
  async function(){
    return jwt.sign({
_id:this.id},
process.env.REFRESH_TOKEN_SECRET,
{ExpiresIn: process.env.REFRESH_TOKEN_EXPIRY}
)
  };


//OTP Generation on basis of Purpose
userSchema.methods.generateOtp= function (purpose){
const otp = crypto.randomInt(100000,1000000).toString();
const expiryTime= Date.now() + 10*60*1000; //10mins

if(purpose==="email_verification"){
  this.emailVerificationOtp = otp;
  this.emailVerificationOtpExpires = expiryTime;
}
else if(purpose==="forgot_password"){
  this.forgotPasswordOtp = otp;
  this.forgotPasswordOtpExpires = expiryTime;
}
else if(purpose==="reset_password"){
this.resetPasswordOtp = otp;
this.resetPasswordOtpExpires = expiryTime
}
else{
  throw new Error("Invalid OTP generation purpose specified")
}

return otp;
}