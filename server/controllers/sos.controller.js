const prisma = require("../config/db");

const EARTH_RADIUS_KM = 6371;
const SOS_RADIUS_KM = 0.2; // 200 meters

const getDistanceKm = (lat1, lng1, lat2, lng2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Create a new SOS signal — deactivates any existing active signal for the user first.
 */
const createSos = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    // Keep user's latest location in sync for SOS proximity matching.
    await prisma.user.update({
      where: { id: req.user.id },
      data: { latitude: lat, longitude: lng },
    });

    // Deactivate previous active signals for this user
    const previousSignals = await prisma.sosSignal.findMany({
      where: { userId: req.user.id, isActive: true },
      select: { id: true },
    });

    if (previousSignals.length > 0) {
      await prisma.sosSignal.updateMany({
        where: { userId: req.user.id, isActive: true },
        data: { isActive: false },
      });
    }

    const signal = await prisma.sosSignal.create({
      data: {
        userId: req.user.id,
        latitude: lat,
        longitude: lng,
      },
      include: {
        user: { select: { id: true, displayName: true, profilePhoto: true } },
      },
    });

    const io = req.app.get("io");
    if (io) {
      previousSignals.forEach((s) => {
        io.emit("sos-resolved", { userId: req.user.id, signalId: s.id });
      });
      io.emit("sos-signal", signal);
    }

    // Notify nearby users (within 200m radius)
    const allUsers = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, latitude: true, longitude: true },
    });

    const nearbyUsers = allUsers.filter((u) =>
      getDistanceKm(lat, lng, u.latitude, u.longitude) <= SOS_RADIUS_KM,
    );

    let createdNotifications = [];
    if (nearbyUsers.length > 0) {
      const senderName = signal.user.displayName || "Someone";
      createdNotifications = await prisma.$transaction(
        nearbyUsers.map((u) =>
          prisma.notification.create({
            data: {
              recipientId: u.id,
              type: "SOS_ALERT",
              title: "SOS Alert Nearby",
              message: `${senderName} needs help near your location!`,
              relatedUserId: req.user.id,
            },
          }),
        ),
      );

      if (io) {
        createdNotifications.forEach((notif) => {
          io.to(`user_${notif.recipientId}`).emit("new-notification", notif);
        });
      }
    }

    res.status(201).json({
      signal,
      notifiedCount: createdNotifications.length,
    });
  } catch (err) {
    console.error("Create SOS error:", err);
    res.status(500).json({ error: "Failed to create SOS signal." });
  }
};

/**
 * Deactivate the user's active SOS signal(s) (cancel/resolve).
 */
const deactivateSos = async (req, res) => {
  try {
    const activeSignals = await prisma.sosSignal.findMany({
      where: { userId: req.user.id, isActive: true },
      select: { id: true },
    });

    if (activeSignals.length === 0) {
      return res.json({ resolved: 0, signalIds: [] });
    }

    await prisma.sosSignal.updateMany({
      where: { userId: req.user.id, isActive: true },
      data: { isActive: false },
    });

    const io = req.app.get("io");
    if (io) {
      activeSignals.forEach((s) => {
        io.emit("sos-resolved", { userId: req.user.id, signalId: s.id });
      });
    }

    res.json({
      resolved: activeSignals.length,
      signalIds: activeSignals.map((s) => s.id),
    });
  } catch (err) {
    console.error("Deactivate SOS error:", err);
    res.status(500).json({ error: "Failed to deactivate SOS signal." });
  }
};

/**
 * Complete a specific SOS signal (owner only).
 */
const completeSos = async (req, res) => {
  try {
    const { id } = req.params;
    const signal = await prisma.sosSignal.findUnique({ where: { id } });

    if (!signal || signal.userId !== req.user.id) {
      return res.status(404).json({ error: "SOS signal not found." });
    }

    if (!signal.isActive) {
      return res.json({ signal, message: "SOS signal already completed." });
    }

    const updated = await prisma.sosSignal.update({
      where: { id },
      data: { isActive: false },
      include: {
        user: { select: { id: true, displayName: true, profilePhoto: true } },
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("sos-resolved", { userId: req.user.id, signalId: id });
    }

    res.json({ signal: updated, message: "SOS completed." });
  } catch (err) {
    console.error("Complete SOS error:", err);
    res.status(500).json({ error: "Failed to complete SOS signal." });
  }
};

/**
 * Remove a specific SOS signal (owner only).
 */
const removeSos = async (req, res) => {
  try {
    const { id } = req.params;
    const signal = await prisma.sosSignal.findUnique({ where: { id } });

    if (!signal || signal.userId !== req.user.id) {
      return res.status(404).json({ error: "SOS signal not found." });
    }

    await prisma.sosSignal.delete({ where: { id } });

    const io = req.app.get("io");
    if (io) {
      io.emit("sos-resolved", { userId: req.user.id, signalId: id });
    }

    res.json({ removed: true, id });
  } catch (err) {
    console.error("Remove SOS error:", err);
    res.status(500).json({ error: "Failed to remove SOS signal." });
  }
};

/**
 * Get current user's SOS signals.
 */
const getMySos = async (req, res) => {
  try {
    const signals = await prisma.sosSignal.findMany({
      where: { userId: req.user.id },
      include: {
        user: { select: { id: true, displayName: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ signals });
  } catch (err) {
    console.error("Get my SOS error:", err);
    res.status(500).json({ error: "Failed to fetch your SOS signals." });
  }
};

/**
 * Get all active SOS signals, optionally filtered by lat/lng/radius.
 */
const getActiveSos = async (req, res) => {
  try {
    const signals = await prisma.sosSignal.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, displayName: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // If lat/lng/radius provided, filter in-memory (simple haversine)
    const { lat, lng, radius } = req.query;
    if (lat && lng && radius) {
      const cLat = parseFloat(lat);
      const cLng = parseFloat(lng);
      const maxR = parseFloat(radius);

      if (!Number.isFinite(cLat) || !Number.isFinite(cLng) || !Number.isFinite(maxR)) {
        return res.status(400).json({ error: "Invalid lat/lng/radius query params." });
      }

      const filtered = signals.filter(
        (s) => getDistanceKm(cLat, cLng, s.latitude, s.longitude) <= maxR,
      );
      return res.json({ signals: filtered });
    }

    res.json({ signals });
  } catch (err) {
    console.error("Get active SOS error:", err);
    res.status(500).json({ error: "Failed to fetch SOS signals." });
  }
};

module.exports = {
  createSos,
  deactivateSos,
  completeSos,
  removeSos,
  getMySos,
  getActiveSos,
};
