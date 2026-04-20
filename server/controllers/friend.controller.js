const prisma = require("../config/db");

// POST /api/friends/:id
const addFriend = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.id;

    if (userId === friendId)
      return res.status(400).json({ error: "Cannot add yourself as a friend." });

    // Check the target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: friendId }, select: { id: true } });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const existing = await prisma.friendContact.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    if (existing) return res.status(400).json({ error: "Already added as friend." });

    await prisma.friendContact.create({ data: { userId, friendId } });

    res.status(201).json({ message: "Added friend successfully." });
  } catch (err) {
    console.error("[addFriend] Error:", err.message);
    next(err);
  }
};


// DELETE /api/friends/:id
const removeFriend = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.id;

    await prisma.friendContact.deleteMany({
      where: { userId, friendId },
    });

    res.json({ message: "Removed friend successfully." });
  } catch (err) {
    next(err);
  }
};

// GET /api/friends
const getFriends = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const friendsData = await prisma.friendContact.findMany({
      where: { userId },
      include: {
        friend: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
            trustScore: true,
          },
        },
      },
    });

    res.json({
      friends: friendsData.map((f) => f.friend)
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addFriend,
  removeFriend,
  getFriends,
};
