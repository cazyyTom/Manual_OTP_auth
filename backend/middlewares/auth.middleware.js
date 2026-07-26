import jwt from "jsonwebtoken";
import {User} from "../models/auth.model.js"
import asyncHandler from "../utils/AsyncHandler.js"
import {ApiError} from "../utils/ApiError.js"

export const verifyJWT = asyncHandler(async (req,res)=>{
const token = req.cookie?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
if(!token) throw new ApiError(401, "Unauthorised Request")
let decoded;
try {
decoded = jwt.verify(token, process.env.ACCESS_SECRET_TOKEN)
}catch(err){401, "Invalid or expired token"}

const user = await User.findById(decoded._id)
if(!user) throw new ApiError(400, "User not found");

req.user = user;
next();
})
