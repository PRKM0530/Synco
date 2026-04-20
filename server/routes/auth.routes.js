const express = require("express");
const { body } = require("express-validator");
const { register, login, getMe, verifyEmail, resendOtp, forgotPassword, resetPassword } = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/verify-email
router.post(
  "/verify-email",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("otp").notEmpty().withMessage("OTP is required."),
  ],
  verifyEmail
);

// POST /api/auth/resend-otp
router.post(
  "/resend-otp",
  [body("email").isEmail().withMessage("Valid email is required.")],
  resendOtp
);

// POST /api/auth/forgot-password/send-otp
router.post(
  "/forgot-password/send-otp",
  [body("email").isEmail().withMessage("Valid email is required.")],
  forgotPassword
);

// POST /api/auth/forgot-password/reset
router.post(
  "/forgot-password/reset",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("otp").notEmpty().withMessage("OTP is required."),
    body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters.")
  ],
  resetPassword
);

// POST /api/auth/register
router.post(
  "/register",
  [
    body("email")
      .isEmail()
      .normalizeEmail({ gmail_remove_dots: false })
      .withMessage("Valid email is required."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters."),
    body("displayName")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Display name must be 2–50 characters."),
  ],
  register,
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail({ gmail_remove_dots: false })
      .withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  login,
);

// GET /api/auth/me — requires authentication
router.get("/me", auth, getMe);

module.exports = router;
