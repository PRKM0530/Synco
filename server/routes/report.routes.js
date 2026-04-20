const express = require("express");
const { createReport } = require("../controllers/report.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

// POST /api/reports — Submit a report
router.post("/", auth, createReport);

module.exports = router;
