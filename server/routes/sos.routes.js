const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const {
	createSos,
	deactivateSos,
	completeSos,
	removeSos,
	getMySos,
	getActiveSos,
} = require("../controllers/sos.controller");

// POST /api/sos — create a new SOS signal
router.post("/", auth, createSos);

// DELETE /api/sos — deactivate your active SOS signal
router.delete("/", auth, deactivateSos);

// GET /api/sos/mine — get your SOS signals
router.get("/mine", auth, getMySos);

// PATCH /api/sos/:id/complete — complete one SOS signal
router.patch("/:id/complete", auth, completeSos);

// DELETE /api/sos/:id — remove one SOS signal
router.delete("/:id", auth, removeSos);

// GET /api/sos/active — get all active SOS signals (with optional lat/lng/radius filtering)
router.get("/active", auth, getActiveSos);

module.exports = router;
