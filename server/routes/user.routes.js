const express = require("express");
const { body } = require("express-validator");
const {
  getUserProfile,
  updateProfile,
  uploadPhoto,
  getTrustHistory,
  searchUsers,
  deleteAccount,
  requestEmailChange,
  confirmEmailChange,
} = require("../controllers/user.controller");
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// GET /api/users/search — search users by name/email
// Place this BEFORE /:id so "search" isn't interpreted as an ID
router.get("/search", auth, searchUsers);

// GET /api/users/:id — public profile
router.get("/:id", auth, getUserProfile);

// PUT /api/users/me — update own profile
router.put(
  "/me",
  auth,
  [
    body("displayName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Display name must be 2–50 characters."),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio must be under 500 characters."),
  ],
  updateProfile,
);

// POST /api/users/me/photo — upload profile photo
router.post("/me/photo", auth, upload.single("photo"), uploadPhoto);

// GET /api/users/:id/trust-history
router.get("/:id/trust-history", auth, getTrustHistory);

// DELETE /api/users/me — delete account
router.delete("/me", auth, deleteAccount);

// POST /api/users/me/request-email-change — send OTP to new email
router.post("/me/request-email-change", auth, requestEmailChange);

// POST /api/users/me/confirm-email-change — verify OTP and update email
router.post("/me/confirm-email-change", auth, confirmEmailChange);

module.exports = router;
