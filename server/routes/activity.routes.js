/**
 * activity.routes.js
 * REST routes for Activity CRUD operations.
 * Verification and roster endpoints live in verification.routes.js.
 */

const express = require("express");
const { body } = require("express-validator");
const {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  toggleCoHost,
} = require("../controllers/activity.controller");
const { auth, optionalAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/activities — browsable feed (upcoming, public or friends-only)
router.get("/", optionalAuth, getActivities);

// GET /api/activities/:id — activity detail (works without login)
router.get("/:id", optionalAuth, getActivityById);

// POST /api/activities — create a new activity
router.post(
  "/",
  auth,
  [
    body("title")
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage("Title must be 3–100 characters."),
    body("category").notEmpty().withMessage("Category is required."),
    body("latitude").isNumeric().withMessage("Valid latitude required."),
    body("longitude").isNumeric().withMessage("Valid longitude required."),
    body("address").notEmpty().withMessage("Address is required."),
    body("date").isISO8601().withMessage("Valid ISO date-time required."),
    body("maxParticipants")
      .isInt({ min: 2 })
      .withMessage("Must allow at least 2 participants."),
  ],
  createActivity,
);

// PUT /api/activities/:id — edit activity (host/co-host/admin)
router.put("/:id", auth, updateActivity);

// DELETE /api/activities/:id — cancel/delete activity (original host/admin only)
router.delete("/:id", auth, deleteActivity);

// PUT /api/activities/:id/cohosts/:memberUserId — promote/demote a member to host (original host only)
router.put("/:id/cohosts/:memberUserId", auth, toggleCoHost);

module.exports = router;
