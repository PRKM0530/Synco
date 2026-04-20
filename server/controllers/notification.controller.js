const prisma = require("../config/db");

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id },
      include: {
        relatedActivity: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.recipientId !== req.user.id) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ message: "Marked as read." });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.recipientId !== req.user.id) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ message: "Notification deleted." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  deleteNotification,
};
