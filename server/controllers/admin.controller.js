const prisma = require("../config/db");

exports.getReports = async (req, res, next) => {
  try {
    const { status = "PENDING" } = req.query;
    const reports = await prisma.report.findMany({
      where: status === "ALL" ? {} : { status },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
            email: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            displayName: true,
            profilePhoto: true,
            email: true,
            trustScore: true,
            isBanned: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
};

exports.resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body; // status: WARNED | ACTION_TAKEN | DISMISSED

    // Fetch the report first so we know who was reported
    const existing = await prisma.report.findUnique({
      where: { id },
      select: { reportedUserId: true, reason: true },
    });

    const report = await prisma.report.update({
      where: { id },
      data: { status, adminNotes },
    });

    // Notify the reported user if they were warned or banned
    if (existing && (status === "WARNED" || status === "ACTION_TAKEN")) {
      const isBan = status === "ACTION_TAKEN";
      await prisma.notification.create({
        data: {
          recipientId: existing.reportedUserId,
          type: "REMINDER",
          title: isBan ? "Account Banned" : "Platform Warning",
          message: isBan
            ? "Your account has been banned due to a community guideline violation. Contact support if you believe this is an error."
            : `Warning: ${adminNotes || "Please review our community guidelines."}`,
        },
      });
    }

    res.json({ message: "Report updated.", report });
  } catch (err) {
    next(err);
  }
};

exports.banUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: true },
    });
    // Mark any pending reports on this user as ACTION_TAKEN
    await prisma.report.updateMany({
      where: { reportedUserId: id, status: "PENDING" },
      data: { status: "ACTION_TAKEN", adminNotes: "User banned by admin." },
    });
    res.json({ message: `${user.displayName} has been banned.` });
  } catch (err) {
    next(err);
  }
};

exports.unbanUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: false },
    });
    res.json({ message: `${user.displayName} has been unbanned.` });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const [userCount, activityCount, reportCount, pendingReports] =
      await Promise.all([
        prisma.user.count(),
        prisma.activity.count(),
        prisma.report.count(),
        prisma.report.count({ where: { status: "PENDING" } }),
      ]);
    res.json({
      stats: { userCount, activityCount, reportCount, pendingReports },
    });
  } catch (err) {
    next(err);
  }
};
