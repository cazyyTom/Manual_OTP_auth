import { body } from "express-validator";

export const registerValidator = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isLength({ min: 3, max: 8 })
    .withMessage("Username must be 3-8 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      "username can only contain lowercase, uppercase, numbers and underscores",
    ),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isEmail()
    .withMessage("Please Provide a valid email"),

  body("password")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isLength({ min: 8 })
    .withMessage("Password must be minimum 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
];

export const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isEmail()
    .withMessage("Please Provide a valid email"),

  body("password")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
];

export const forgotPasswordValidator = [
    body("email")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isEmail()
    .withMessage("Please Provide a valid email"),
]

export const changePasswordValidator = [
    body("currentPassword")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input"),

    body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isLength({ min: 8 })
    .withMessage("Password must be minimum 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
]

export const resetPasswordValidator = [
    body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("Please provide an input")
    .isLength({ min: 8 })
    .withMessage("Password must be minimum 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
]