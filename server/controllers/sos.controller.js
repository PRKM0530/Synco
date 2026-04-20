const prisma = require("../config/db");

/**
 * Create a new SOS signal — deactivates any existing active signal for the user first.
 */
const createSos = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    // Deactivate previous active signal for this user
    await prisma.sosSignal.updateMany({
      where: { userId: req.user.id, isActive: true },
      data: { isActive: false },
    });

    const signal = await prisma.sosSignal.create({
      data: {
        userId: req.user.id,
        latitude,
        longitude,
      },
      include: {
        user: { select: { id: true, displayName: true, profilePhoto: true } },
      },
    });

    // Emit via socket if available
    const io = req.app.get("io");
    if (io) {
      io.emit("sos-signal", signal);
    }

    // Notify nearby users (within 200m radius)
    const SOS_RADIUS_KM = 0.2; // 200 meters
    const allUsers = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, latitude: true, longitude: true },
    });

    const R = 6371; // Earth radius in km
    const nearbyUserIds = allUsers
      .filter((u) => {
        const dLat = ((u.latitude - latitude) * Math.PI) / 180;
        const dLng = ((u.longitude - longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((latitude * Math.PI) / 180) *
            Math.cos((u.latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return d <= SOS_RADIUS_KM;
      })
      .map((u) => u.id);

    if (nearbyUserIds.length > 0) {
      const senderName = signal.user.displayName || "Someone";
      const notifications = nearbyUserIds.map((recipientId) => ({
        recipientId,
        type: "SOS_ALERT",
        title: "SOS Alert Nearby",
        message: `${senderName} needs help near your location!`,
        relatedUserId: req.user.id,
      }));

      await prisma.notification.createMany({ data: notifications });

      // Emit socket event to each nearby user
      if (io) {
        for (const uid of nearbyUserIds) {
          io.to(`user_${uid}`).emit("new-notification", {
            type: "SOS_ALERT",
            title: "SOS Alert Nearby",
            message: `${senderName} needs help near your location!`,
            relatedUserId: req.user.id,
            createdAt: new Date(),
          });
        }
      }
    }

    res.status(201).json({ signal });
  } catch (err) {
    console.error("Create SOS error:", err);
    res.status(500).json({ error: "Failed to create SOS signal." });
  }
};

/**
 * Deactivate the user's active SOS signal (cancel/resolve).
 */
const deactivateSos = async (req, res) => {
  try {
    const updated = await prisma.sosSignal.updateMany({
      where: { userId: req.user.id, isActive: true },
      data: { isActive: false },
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("sos-resolved", { userId: req.user.id });
    }

    res.json({ resolved: updated.count });
  } catch (err) {
    console.error("Deactivate SOS error:", err);
    res.status(500).json({ error: "Failed to deactivate SOS signal." });
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
      const R = 6371;
      const cLat = parseFloat(lat);
      const cLng = parseFloat(lng);
      const maxR = parseFloat(radius);
      const filtered = signals.filter((s) => {
        const dLat = ((s.latitude - cLat) * Math.PI) / 180;
        const dLng = ((s.longitude - cLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((cLat * Math.PI) / 180) *
            Math.cos((s.latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return d <= maxR;
      });
      return res.json({ signals: filtered });
    }

    res.json({ signals });
  } catch (err) {
    console.error("Get active SOS error:", err);
    res.status(500).json({ error: "Failed to fetch SOS signals." });
  }
};

module.exports = { createSos, deactivateSos, getActiveSos };
