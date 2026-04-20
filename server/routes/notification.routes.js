const express = require("express");
const {
  getNotifications,
  markAsRead,
  deleteNotification,
} = require("../controllers/notification.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getNotifications);
router.put("/:id/read", auth, markAsRead);
router.delete("/:id", auth, deleteNotification);

module.exports = router;
