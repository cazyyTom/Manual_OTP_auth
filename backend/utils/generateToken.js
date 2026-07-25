import {User} from '../models/User.js';
import {ApiError} from './ApiError.js';

export const generateAccessAndRefreshTokens = async (userId) => {
    const user = await User.findById(userId)
    if(!user) throw new ApiError(400, "User not found");

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false})
    return {accessToken, refreshToken};

};