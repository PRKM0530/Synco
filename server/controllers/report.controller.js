const prisma = require("../config/db");

// POST /api/reports — Report a user
const createReport = async (req, res, next) => {
  try {
    const reporterId = req.user.id;
    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason) {
      return res
        .status(400)
        .json({ error: "Reported user and reason are required." });
    }

    if (reporterId === reportedUserId) {
      return res.status(400).json({ error: "You cannot report yourself." });
    }

    const reportedUser = await prisma.user.findUnique({
      where: { id: reportedUserId },
    });
    if (!reportedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedUserId,
        reason,
        description: description || "",
      },
    });

    res
      .status(201)
      .json({ message: "Report submitted. Our team will review it.", report });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReport };
