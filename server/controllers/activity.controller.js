/**
 * Activity CRUD operations.
 * Trust scoring and verification logic lives in verification.controller.js.
 */

const { validationResult } = require("express-validator");
const prisma = require("../config/db");


/**
 * Haversine formula — calculates straight-line distance between two GPS
 * coordinates. Returns distance in kilometres.
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Create a new activity.
 * The host is automatically added as a member so they can access the group chat.
 */
const createActivity = async (req, res, next) => {
  try {
    // Reject if express-validator found errors (from activity.routes.js)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      tags,
      category,
      latitude,
      longitude,
      address,
      date,
      duration,
      maxParticipants,
      visibility,
    } = req.body;

    // Create the activity record in the database
    const activity = await prisma.activity.create({
      data: {
        hostId: req.user.id,
        title,
        description,
        tags: Array.isArray(tags) ? tags : JSON.parse(tags || "[]"),
        category,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        date: new Date(date),
        duration: duration ? parseInt(duration) : null,
        maxParticipants: parseInt(maxParticipants),
        visibility: visibility || "PUBLIC",
      },
      include: {
        host: { select: { id: true, displayName: true, profilePhoto: true } },
      },
    });

    // Auto-join the host so they appear in their own activity's member list
    await prisma.activityMember.create({
      data: { activityId: activity.id, userId: req.user.id },
    });

    res.status(201).json({ message: "Activity created.", activity });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch all UPCOMING public activities.
 * Optionally filtered by category, and sorted by distance if lat/lng provided.
 * Only upcoming activities are ever shown in the feed or map view.
 */
const getActivities = async (req, res, next) => {
  try {
    const { lat, lng, radius = 50, category, search, date, visibility } = req.query;
    const userId = req.user?.id;


    let where = {
      status: { in: ["UPCOMING"] },
    };

    // Permission-based Visibility
    // 1. PUBLIC: Show all public + own + friends' activities
    // 2. FRIENDS: Show ONLY own + friends' activities
    let friendIds = [];
    if (userId) {
      const friendContacts = await prisma.friendContact.findMany({
        where: { userId },
        select: { friendId: true },
      });
      friendIds = friendContacts.map((f) => f.friendId);
    }

    // Base visibility rule 1: "everyone can see PUBLIC, friends can see FRIENDS-only"
    const baseVisibilityRules = [
      { visibility: "PUBLIC" }
    ];

    if (userId) {
      baseVisibilityRules.push({ hostId: userId }); // User can always see their own
      baseVisibilityRules.push({
        visibility: "FRIENDS",
        host: {
          friends: {
            // The host's friend list includes the current viewer
            some: { friendId: userId }
          }
        }
      });
    }

    if (visibility === "FRIENDS") {
      if (!userId) {
        return res.status(401).json({ error: "Must be logged in to filter by friends." });
      }
      // Feed filter "Friends Only" should show:
      // 1. My own activities
      // 2. Activities created by people I added, IF permitted by base rule (i.e. they are public, or they added me back)
      where.OR = [
        { hostId: userId },
        { 
          AND: [
            { hostId: { in: friendIds } },
            { OR: baseVisibilityRules }
          ] 
        }
      ];
    } else {
      // 2nd rule: "if public choosen i can see all activities i am permitted as per rule 1"
      where.OR = baseVisibilityRules;
    }


    if (category) where.category = category;
    
    if (search) {
      const searchCondition = [
        { title: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
      // If we already have an OR from visibility, nest search within AND
      if (where.OR) {
        where.AND = [{ OR: where.OR }];
        where.AND.push({ OR: searchCondition });
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    // Always restrict to future activities (not yet started)
    const now = new Date();
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      // If the chosen date is today, use current time as lower bound
      where.date = {
        gte: now > startDate ? now : startDate,
        lte: endDate,
      };
    } else {
      // No date filter: only show activities that haven't started yet
      where.date = { gt: now };
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        host: { select: { id: true, displayName: true, profilePhoto: true } },
        _count: { select: { members: true } },
      },
      orderBy: { date: "asc" },
      take: 100,
    });

    let filteredActivities = activities;
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const r = parseFloat(radius);

      filteredActivities = activities
        .map((act) => ({
          ...act,
          distance: getDistance(userLat, userLng, act.latitude, act.longitude),
        }))
        .filter((act) => act.distance <= r)
        .sort((a, b) => a.distance - b.distance);
    }

    res.json({ activities: filteredActivities });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single activity with its host, members, and the requesting user's
 * join status (if logged in). Used by ActivityDetailPage.
 */
const getActivityById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
            trustScore: true,
          },
        },
        // Only fetch the current user's join request (not everyone's)
        joinRequests: req.user ? { where: { userId: req.user.id } } : false,
        members: {
          include: {
            user: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    // Rule 1: Enforce visibility for activity details
    if (activity.visibility === "FRIENDS") {
      if (!req.user) {
        return res.status(403).json({ error: "This activity is only visible to friends of the host." });
      }

      if (activity.hostId !== req.user.id) {
        // Check if the current user (viewer) is in the host's friend list
        const isFriend = await prisma.friendContact.findFirst({
          where: {
            userId: activity.hostId, // Host owns the list
            friendId: req.user.id,   // Viewer is on the list
          },
        });

        if (!isFriend) {
          return res.status(403).json({ error: "This activity is only visible to friends of the host." });
        }
      }
    }

    res.json({ activity });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an activity's details. Only the host (or an admin) can do this.
 * Only allowed before the activity starts (enforced on the frontend).
 */
const updateActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    // Allow co-hosts full edit access
    const isCoHost = await prisma.activityMember.findFirst({
      where: { activityId: id, userId: req.user.id, isCoHost: true },
    });
    if (activity.hostId !== req.user.id && !isCoHost && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only the host can edit this activity." });
    }

    // Normalise the date and tags fields if they were sent as strings
    const safeData = {};
    if (updateData.title)          safeData.title          = updateData.title;
    if (updateData.description !== undefined) safeData.description = updateData.description;
    if (updateData.category)       safeData.category       = updateData.category;
    if (updateData.address)        safeData.address        = updateData.address;
    if (updateData.date)           safeData.date           = new Date(updateData.date);
    if (updateData.duration !== undefined) safeData.duration = updateData.duration ? parseInt(updateData.duration) : null;
    if (updateData.maxParticipants) safeData.maxParticipants = parseInt(updateData.maxParticipants);
    if (updateData.visibility)     safeData.visibility     = updateData.visibility;
    if (updateData.latitude !== undefined)  safeData.latitude  = parseFloat(updateData.latitude);
    if (updateData.longitude !== undefined) safeData.longitude = parseFloat(updateData.longitude);
    if (updateData.tags !== undefined) {
      safeData.tags = typeof updateData.tags === "string" ? JSON.parse(updateData.tags) : updateData.tags;
    }

    const updated = await prisma.activity.update({
      where: { id },
      data: safeData,
    });

    res.json({ message: "Activity updated.", activity: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel and permanently delete an activity.
 * Only the host (or an admin) can cancel. Typically used before the event starts.
 * Cascading deletes in the schema remove members, join-requests, and chat room automatically.
 */
const deleteActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    // Allow co-hosts to delete as well
    const isCoHost = await prisma.activityMember.findFirst({
      where: { activityId: id, userId: req.user.id, isCoHost: true },
    });
    if (activity.hostId !== req.user.id && !isCoHost && req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Only the host can cancel this activity." });
    }

    await prisma.activity.delete({ where: { id } });

    res.json({ message: "Activity cancelled and deleted." });
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle co-host status for an approved activity member.
 * Only the original host can call this endpoint.
 */
const toggleCoHost = async (req, res, next) => {
  try {
    const { id, memberUserId } = req.params;

    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) return res.status(404).json({ error: "Activity not found." });

    if (activity.hostId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only the original host can manage co-hosts." });
    }

    // Cannot promote/demote the host themselves
    if (memberUserId === activity.hostId) {
      return res.status(400).json({ error: "The host cannot be made a co-host." });
    }

    const membership = await prisma.activityMember.findUnique({
      where: { activityId_userId: { activityId: id, userId: memberUserId } },
    });
    if (!membership) {
      return res.status(404).json({ error: "This user is not a member of the activity." });
    }

    const updated = await prisma.activityMember.update({
      where: { activityId_userId: { activityId: id, userId: memberUserId } },
      data: { isCoHost: !membership.isCoHost },
    });

    res.json({
      message: updated.isCoHost ? "User promoted to host." : "User demoted from host.",
      isCoHost: updated.isCoHost,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/activities/mine
 * Return activities the current user is hosting OR has joined (approved member).
 */
const getMyActivities = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Activities this user created
    const hosted = await prisma.activity.findMany({
      where: { hostId: userId },
      include: {
        host: { select: { id: true, displayName: true, profilePhoto: true } },
        _count: { select: { members: true } },
      },
      orderBy: { date: "desc" },
    });

    // Activities this user joined (approved member, not host)
    const memberships = await prisma.activityMember.findMany({
      where: { userId },
      select: { activityId: true },
    });
    const joinedIds = memberships.map((m) => m.activityId);

    const joined = await prisma.activity.findMany({
      where: { id: { in: joinedIds }, hostId: { not: userId } },
      include: {
        host: { select: { id: true, displayName: true, profilePhoto: true } },
        _count: { select: { members: true } },
      },
      orderBy: { date: "desc" },
    });

    res.json({ hosted, joined });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createActivity,
  getActivities,
  getActivityById,
  getMyActivities,
  updateActivity,
  deleteActivity,
  toggleCoHost,
};
