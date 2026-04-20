const express = require("express");
const {
  submitVerification,
  submitRoster,
  getVerifications,
  getMyVerification,
} = require("../controllers/verification.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

// POST /api/activities/:id/verify — Participant submits vote
router.post("/:id/verify", auth, submitVerification);

// GET /api/activities/:id/verifications — Host views member verifications
router.get("/:id/verifications", auth, getVerifications);

// GET /api/activities/:id/my-verification — Participant checks own vote
router.get("/:id/my-verification", auth, getMyVerification);

// POST /api/activities/:id/roster — Host submits attendance roster
router.post("/:id/roster", auth, submitRoster);

module.exports = router;
