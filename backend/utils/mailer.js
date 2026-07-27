import nodemailer from "nodemailer";
import Mailgen from "mailgen";
import { ApiError } from "../utils/apiError.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "Manual OTP Auth",
    link: process.env.CLIENT_URL,
    //logo: 'https://mailgen.js/img/logo.png'
  },
});

//Dynamic co ntent for email
export const sendEmail = async (options) => {
  const emailHtml = mailGenerator.generate(options.mailgenContent);
  const emailText = mailGenerator.generatePlaintext(options.mailgenContent);

  const mail = {
    from: process.env.SMTP_FROM,
    to: options.email,
    subject: options.subject,
    html: emailHtml,
    text: emailText,
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    throw new ApiError(
      500,
      "Error occurred while sending email",
      error.message,
    );
  }
};

//Templates for email content

export const verificationEmailTemplate = (username, emailVerificationOtp) => ({
  subject: "Otp for Email Verification",
  body: {
    name: username,
    intro:
      "Welcome to Manual OTP Auth! We're very excited to have you on board.",
    action: {
      instructions:
        "To get started with your account, please use the following OTP for email verification:",
      button: {
        color: "#22BC66",
        text: `Your OTP is ${emailVerificationOtp}`,
        link: "#",
      },
    },
    outro:
      "Need help, or have questions? Just reply to this email, we'd love to help.",
  },
});

export const passwordResetEmailTemplate = (username, forgotPasswordOtp) => ({
  subject: "Otp for Password Reset",
  body: {
    name: username,
    intro:
      "We received a request to reset your password. If you did not make this request, please ignore this email.",
    action: {
      instructions: "To reset your password, please use the following OTP:",
      button: {
        color: "#FF0000",
        text: `Your OTP is ${forgotPasswordOtp}`,
        link: "#",
      },
    },
    outro: "If you did not request a password reset, please ignore this email.",
  },
});
