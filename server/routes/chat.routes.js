const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { auth } = require("../middleware/auth");

router.get("/activities/:activityId", auth, chatController.getActivityMessages);
router.put("/activities/:activityId/read", auth, chatController.markChatRead);

router.put("/messages/:messageId/pin", auth, chatController.pinMessage);
router.delete("/messages/:messageId", auth, chatController.deleteMessage);

router.get("/dms", auth, chatController.getInbox);
router.get("/dms/:friendId", auth, chatController.getDirectMessages);
router.put("/dms/:friendId/read", auth, chatController.markDMRead);

module.exports = router;
