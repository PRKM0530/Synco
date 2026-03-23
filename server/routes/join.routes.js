const express = require("express");
const {
  requestJoin,
  getActivityRequests,
  resolveJoinRequest,
  leaveActivity,
  kickParticipant,
} = require("../controllers/join.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Base route: /api/activities

// POST /api/activities/:id/join
router.post("/:id/join", auth, requestJoin);

// DELETE /api/activities/:id/leave
router.delete("/:id/leave", auth, leaveActivity);

// GET /api/activities/:id/requests
router.get("/:id/requests", auth, getActivityRequests);

// PUT /api/activities/requests/:reqId
router.put("/requests/:reqId", auth, resolveJoinRequest);

// DELETE /api/activities/:id/kick/:userId
router.delete("/:id/kick/:userId", auth, kickParticipant);

module.exports = router;
