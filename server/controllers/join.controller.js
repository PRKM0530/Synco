const prisma = require("../config/db");

// POST /api/activities/:id/join
const requestJoin = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;
    const userId = req.user.id;

    // Check if activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    // Cannot join own activity (host is already member)
    if (activity.hostId === userId) {
      return res.status(400).json({ error: "You are already the host." });
    }

    // Check if full
    if (activity._count.members >= activity.maxParticipants) {
      return res.status(400).json({ error: "Activity is full." });
    }

    // Check if already a member
    const existingMember = await prisma.activityMember.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (existingMember) {
      return res
        .status(400)
        .json({ error: "You are already a member of this activity." });
    }

    // Check if request already exists
    const existingReq = await prisma.joinRequest.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (existingReq) {
      if (existingReq.status === "BANNED") {
        return res.status(403).json({ error: "You are banned from joining this activity." });
      }
      return res
        .status(400)
        .json({ error: "You have already sent a request." });
    }

    // Create Request
    const joinRequest = await prisma.joinRequest.create({
      data: { activityId, userId },
    });

    // Notify Host
    await prisma.notification.create({
      data: {
        recipientId: activity.hostId,
        type: "JOIN_REQUEST",
        title: "New Join Request",
        message: `${req.user.displayName} wants to join ${activity.title}.`,
        activityId: activity.id,
        relatedUserId: userId,
      },
    });

    res
      .status(201)
      .json({ message: "Request sent successfully.", joinRequest });
  } catch (err) {
    next(err);
  }
};

// GET /api/activities/:id/requests (Host only)
const getActivityRequests = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.hostId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized." });
    }

    const requests = await prisma.joinRequest.findMany({
      where: { activityId, status: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
            trustScore: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

// PUT /api/activities/requests/:reqId (Host only)
const resolveJoinRequest = async (req, res, next) => {
  try {
    const { reqId } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: reqId },
      include: { activity: true },
    });

    if (!joinRequest)
      return res.status(404).json({ error: "Request not found." });

    // Check host authorization
    if (joinRequest.activity.hostId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized." });
    }

    // Process update
    const updatedRequest = await prisma.joinRequest.update({
      where: { id: reqId },
      data: { status },
    });

    // If approved, create member & give small trust points for joining
    if (status === "APPROVED") {
      try {
        await prisma.activityMember.create({
          data: {
            activityId: joinRequest.activityId,
            userId: joinRequest.userId,
          },
        });

        await prisma.user.update({
          where: { id: joinRequest.userId },
          data: { trustScore: { increment: 5 } },
        });
      } catch (err) {
        // might fail if user already member
      }
    }

    // Notify User
    await prisma.notification.create({
      data: {
        recipientId: joinRequest.userId,
        type: status === "APPROVED" ? "APPROVAL" : "REJECTION",
        title: status === "APPROVED" ? "Request Approved!" : "Request Declined",
        message:
          status === "APPROVED"
            ? `You were approved to join ${joinRequest.activity.title}.`
            : `Your request for ${joinRequest.activity.title} was declined.`,
        activityId: joinRequest.activityId,
      },
    });

    res.json({ message: `Request ${status.toLowerCase()}.` });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/activities/:id/leave
const leaveActivity = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;
    const userId = req.user.id;

    // Check if user is host
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });
    if (activity.hostId === userId) {
      return res
        .status(400)
        .json({
          error: "Hosts cannot leave their own activity. Cancel it instead.",
        });
    }

    // Delete membership
    await prisma.activityMember.deleteMany({
      where: { activityId, userId },
    });

    // Optionally delete from Join Requests to clear history
    await prisma.joinRequest.deleteMany({
      where: { activityId, userId },
    });

    res.json({ message: "Successfully left the activity." });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/activities/:id/kick/:userId
const kickParticipant = async (req, res, next) => {
  try {
    const { id: activityId, userId: targetUserId } = req.params;
    const currentUserId = req.user.id;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) return res.status(404).json({ error: "Activity not found." });

    if (activity.hostId !== currentUserId) {
      return res.status(403).json({ error: "Only the host can remove participants." });
    }

    if (targetUserId === activity.hostId) {
      return res.status(400).json({ error: "Host cannot kick themselves." });
    }

    // Delete membership
    await prisma.activityMember.deleteMany({
      where: { activityId, userId: targetUserId },
    });

    // Ban via JoinRequest
    await prisma.joinRequest.upsert({
      where: { activityId_userId: { activityId, userId: targetUserId } },
      create: { activityId, userId: targetUserId, status: "BANNED" },
      update: { status: "BANNED" },
    });

    res.json({ message: "Participant removed and banned from this activity." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requestJoin,
  getActivityRequests,
  resolveJoinRequest,
  leaveActivity,
  kickParticipant,
};
