const { validationResult } = require("express-validator");
const prisma = require("../config/db");
const { sendOtpEmail } = require("../utils/email");

/**
 * GET /api/users/:id
 * Get a user's public profile
 */
const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate the ID looks reasonable (prevent lookups with 'undefined')
    if (!id || id === 'undefined') {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        interests: true,
        trustScore: true,
        createdAt: true,
        hostedActivities: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        activityMembers: {
          orderBy: { joinedAt: "desc" },
          take: 20,
          include: {
            activity: true,
          },
        },
        trustLogs: {
          orderBy: { createdAt: "desc" },
          take: 100,
          where: { activityId: { not: null } },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const friendsCount = await prisma.friendContact.count({
      where: { userId: id },
    });

    // Filter out activities the user hosted (to get only joined activities)
    const joinedActivities = user.activityMembers.filter(
      (m) => m.activity.hostId !== id
    );

    // Build a map of activityId -> pointsChange from trust logs
    const pointsByActivity = {};
    for (const log of user.trustLogs || []) {
      if (log.activityId) {
        // Accumulate in case multiple logs exist per activity
        pointsByActivity[log.activityId] = (pointsByActivity[log.activityId] || 0) + log.pointsChange;
      }
    }

    res.json({
      user: {
        ...user,
        activityMembers: joinedActivities,
        friendsCount,
        joinedCount: joinedActivities.length,
        hostedCount: user.hostedActivities.length,
        pointsByActivity,
      },
    });
  } catch (err) {
    console.error('[getUserProfile] Error:', err.message);
    next(err);
  }
};

/**
 * PUT /api/users/me
 * Update current user's profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { displayName, bio, interests, latitude, longitude } = req.body;

    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (interests !== undefined) {
      updateData.interests = Array.isArray(interests)
        ? interests
        : JSON.parse(interests);
    }
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        interests: true,
        latitude: true,
        longitude: true,
        trustScore: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.json({ message: "Profile updated.", user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/photo
 * Upload profile photo
 */
const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePhoto: photoUrl },
      select: {
        id: true,
        profilePhoto: true,
      },
    });

    res.json({ message: "Photo uploaded.", profilePhoto: user.profilePhoto });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id/trust-history
 * Get a user's trust score history
 */
const getTrustHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const logs = await prisma.trustLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const user = await prisma.user.findUnique({
      where: { id },
      select: { trustScore: true },
    });

    res.json({ trustScore: user?.trustScore, logs });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/search
 * Search users by displayName or email
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }

    const currentUserId = req.user.id;

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          { id: { not: currentUserId } }, // exclude self
        ]
      },
      select: {
        id: true,
        displayName: true,
        profilePhoto: true,
        trustScore: true,
      },
      take: 20,
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/me
 * Delete the currently authenticated user's account permanently
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userEmail = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    // Run deletions in a transaction to ensure no orphaned data
    await prisma.$transaction(async (tx) => {
      // 1. TrustLogs
      await tx.trustLog.deleteMany({ where: { userId } });

      // 2. ActivityVerifications
      await tx.activityVerification.deleteMany({ where: { participantId: userId } });

      // 3. Reports
      await tx.report.deleteMany({
        where: { OR: [{ reporterId: userId }, { reportedUserId: userId }] },
      });

      // 4. Notifications
      await tx.notification.deleteMany({
        where: { OR: [{ recipientId: userId }, { relatedUserId: userId }] },
      });

      // 5. Join requests
      await tx.joinRequest.deleteMany({
        where: { OR: [{ userId }, { activity: { hostId: userId } }] },
      });

      // 6. Direct Messages
      await tx.directMessage.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      });

      // 7. Group Chat Messages (for user or for rooms user created activities)
      await tx.chatMessage.deleteMany({
        where: { OR: [{ senderId: userId }, { room: { activity: { hostId: userId } } }] },
      });

      // 8. Chat Room Memberships
      await tx.chatRoomMember.deleteMany({ where: { userId } });

      // 9. Activity Members
      await tx.activityMember.deleteMany({
        where: { OR: [{ userId }, { activity: { hostId: userId } }] },
      });

      // 10. Chat Rooms (hosted by user)
      await tx.chatRoom.deleteMany({
        where: { activity: { hostId: userId } },
      });

      // 11. Hosted activities
      await tx.activity.deleteMany({ where: { hostId: userId } });

      // 12. Friends
      await tx.friendContact.deleteMany({
        where: { OR: [{ userId }, { friendId: userId }] },
      });

      // 13. Verification Tokens
      if (userEmail?.email) {
        await tx.verificationToken.deleteMany({ where: { email: userEmail.email } });
      }

      // 14. Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/request-email-change
 * Sends an OTP to the new email for verification.
 */
const requestEmailChange = async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: "A valid new email address is required." });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email: true } });
    if (currentUser.email === newEmail.toLowerCase()) {
      return res.status(400).json({ error: "New email must be different from your current email." });
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: "This email is already in use by another account." });
    }

    await prisma.verificationToken.deleteMany({ where: { email: newEmail.toLowerCase() } });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { email: newEmail.toLowerCase(), token: otp, expiresAt },
    });

    await sendOtpEmail(newEmail, otp, { isEmailChange: true });

    res.json({ message: `Verification code sent to ${newEmail}` });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/me/confirm-email-change
 * Verifies OTP and updates the user's email
 */
const confirmEmailChange = async (req, res, next) => {
  try {
    const { newEmail, otp } = req.body;
    if (!newEmail || !otp) {
      return res.status(400).json({ error: "New email and OTP are required." });
    }

    const record = await prisma.verificationToken.findFirst({
      where: { email: newEmail.toLowerCase(), token: otp },
    });
    if (!record) return res.status(400).json({ error: "Invalid verification code." });
    if (new Date() > record.expiresAt) return res.status(400).json({ error: "Code expired. Please request a new one." });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { email: newEmail.toLowerCase(), isVerified: true },
    });

    await prisma.verificationToken.deleteMany({ where: { email: newEmail.toLowerCase() } });

    res.json({ message: "Email updated successfully.", newEmail: newEmail.toLowerCase() });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  uploadPhoto,
  getTrustHistory,
  searchUsers,
  deleteAccount,
  requestEmailChange,
  confirmEmailChange,
};
