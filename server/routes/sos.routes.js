const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { createSos, deactivateSos, getActiveSos } = require("../controllers/sos.controller");

// POST /api/sos — create a new SOS signal
router.post("/", auth, createSos);

// DELETE /api/sos — deactivate your active SOS signal
router.delete("/", auth, deactivateSos);

// GET /api/sos/active — get all active SOS signals (with optional lat/lng/radius filtering)
router.get("/active", auth, getActiveSos);

module.exports = router;
