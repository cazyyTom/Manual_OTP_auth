import connectDB from "../db/index.js"
import mongoose from "mongoose"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/AsyncHandler.js"

export const healthCheck = asyncHandler(async (req, res, next) => {
    const dbState = mongoose.connection.readyState
const dbStateMap= {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
}
const data = {
    status: "success",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database:{
        state: dbStateMap[dbState] || "unknown",
    },
    memory:{
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        
    }
}
return res.status(200).json(new ApiResponse(200, "Health check successful", data))
})