//Cookies Options
export const cookieOption = {
httpOnly:true,
secure: process.env.NODE_ENV === "production",
sameSite:"strict"
}

//Token Age
export const ACCESS_TOKEN_MAX_AGE= 15*60*1000 //15m
export const REFRESH_TOKEN_MAX_AGE= 7*24*60*60*1000 //7d
export const OTP_RESEND_INTERVAL = 60 * 1000;        // 60s between individual resends
export const OTP_RESEND_MAX_ATTEMPTS = 5;              // max resends per window
export const OTP_RESEND_WINDOW = 24 * 60 * 60 * 1000;  // 24h rolling window

