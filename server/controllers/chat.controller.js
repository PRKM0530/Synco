const prisma = require("../config/db");

// Get Activity Chat History
exports.getActivityMessages = async (req, res, next) => {
  try {
    const { activityId } = req.params;

    // Auth check: is the user a member or host?
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const member = await prisma.activityMember.findUnique({
      where: {
        activityId_userId: { activityId, userId: req.user.id },
      },
    });

    if (!member && activity.hostId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this chat" });
    }

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { activityId },
    });

    if (!chatRoom) {
      return res.json([]); // No messages yet
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: chatRoom.id },
      include: {
        sender: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      messages,
      lastReadAt: member?.lastReadAt || null,
    });
  } catch (error) {
    next(error);
  }
};

// Get Direct Message History
exports.getDirectMessages = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// Toggle Pin Status (Host/Co-host)
exports.pinMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { room: { include: { activity: true } } },
    });

    if (!message) return res.status(404).json({ error: "Message not found" });

    const isCoHost = await prisma.activityMember.findUnique({
      where: {
        activityId_userId: {
          activityId: message.room.activity.id,
          userId,
        },
      },
      select: { isCoHost: true },
    });
    const canManage =
      message.room.activity.hostId === userId || isCoHost?.isCoHost === true;

    if (!canManage) {
      return res.status(403).json({ error: "Only host or co-host can pin messages." });
    }

    if (message.type === "SYSTEM") {
      return res.status(400).json({ error: "System/deleted messages cannot be pinned." });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete Message (Host/Co-host can delete any; participant can delete own)
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { room: { include: { activity: true } } },
    });

    if (!message) return res.status(404).json({ error: "Message not found" });

    const membership = await prisma.activityMember.findUnique({
      where: {
        activityId_userId: {
          activityId: message.room.activity.id,
          userId,
        },
      },
      select: { isCoHost: true },
    });

    const isHost = message.room.activity.hostId === userId;
    const isCoHost = membership?.isCoHost === true;
    const isOwnMessage = message.senderId === userId;

    if (!isHost && !isCoHost && !isOwnMessage) {
      return res.status(403).json({ error: "You are not allowed to delete this message." });
    }

    if (message.type === "SYSTEM") {
      return res.status(400).json({ error: "This message is already deleted." });
    }

    let deletedText = "This message was deleted.";
    if (!isOwnMessage) {
      if (isHost) deletedText = "This message was deleted by host.";
      else if (isCoHost) deletedText = "This message was deleted by co-host.";
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        content: deletedText,
        type: "SYSTEM",
        isPinned: false,
      },
      include: {
        sender: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
    });

    res.json({ message: "Message deleted successfully.", deletedMessage: updated });
  } catch (err) {
    next(err);
  }
};

// Mark Chat Read
exports.markChatRead = async (req, res, next) => {
  try {
    const { activityId } = req.params;
    const userId = req.user.id;

    const member = await prisma.activityMember.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });

    if (member) {
      await prisma.activityMember.update({
        where: { activityId_userId: { activityId, userId } },
        data: { lastReadAt: new Date() },
      });
    }

    res.json({ message: "Marked read." });
  } catch (err) {
    next(err);
  }
};

// GET /api/chat/dms (inbox)
exports.getInbox = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // 1. Direct Messages
    const rawMessages = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, displayName: true, profilePhoto: true } },
        receiver: {
          select: { id: true, displayName: true, profilePhoto: true },
        },
      },
    });

    // Group by friend
    const inboxMap = new Map();
    for (const msg of rawMessages) {
      const friend = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!inboxMap.has(friend.id)) {
        inboxMap.set(friend.id, {
          type: "dm",
          friend,
          lastMessage: msg,
          unreadCount: 0,
        });
      }

      if (msg.receiverId === userId && !msg.isRead) {
        inboxMap.get(friend.id).unreadCount += 1;
      }
    }

    const dms = Array.from(inboxMap.values());

    // 2. Activity Chats
    const userActivities = await prisma.activity.findMany({
      where: {
        OR: [{ hostId: userId }, { members: { some: { userId } } }],
      },
      include: {
        chatRoom: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: {
                  select: { id: true, displayName: true, profilePhoto: true },
                },
              },
            },
          },
        },
        members: {
          where: { userId },
        },
      },
    });

    const activities = [];
    for (const act of userActivities) {
      if (act.chatRoom && act.chatRoom.messages.length > 0) {
        const lastMessage = act.chatRoom.messages[0];
        const lastReadAt = act.members[0]?.lastReadAt;

        let unreadCount = 0;
        if (lastMessage.senderId !== userId) {
          if (
            !lastReadAt ||
            new Date(lastMessage.createdAt) > new Date(lastReadAt)
          ) {
            unreadCount = 1;
          }
        }

        activities.push({
          type: "activity",
          activity: {
            id: act.id,
            title: act.title,
            image: act.imageUrls?.[0] || null,
          },
          lastMessage,
          unreadCount,
        });
      }
    }

    res.json({ inbox: [...dms, ...activities] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/chat/dms/:friendId/read
exports.markDMRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    await prisma.directMessage.updateMany({
      where: {
        senderId: friendId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: "Messages marked as read" });
  } catch (err) {
    next(err);
  }
};
