const express = require("express");
const {
  addFriend,
  removeFriend,
  getFriends,
} = require("../controllers/friend.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getFriends);
router.post("/:id", auth, addFriend);
router.delete("/:id", auth, removeFriend);

module.exports = router;
