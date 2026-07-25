import {User} from '../models/User.js';
import {ApiError} from './ApiError.js';

export const generateAccessAndRefreshTokens = async (userId) => {
    const user = await User.findById(userId)
    if(!user) return new ApiError(400, "User not found");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false})
    return {accessToken, refreshToken};

};