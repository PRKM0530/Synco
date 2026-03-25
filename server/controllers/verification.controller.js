/**
 * verification.controller.js
 * Implements the full Trust Score verification flow:
 *
 *  1. Participant Vote  — once the activity starts, every member submits
 *     one of three choices: YES_ATTENDED, NO_DID_NOT_ATTEND, NOT_CONDUCTED.
 *
 *  2. Host Roster       — the host marks each member as Attended or Absent.
 *     This is the trigger that calculates and distributes trust scores.
 *
 * Score rules (summarised):
 *  • Participant: YES + Host confirms Attended  →  +2 pts
 *  • Participant: YES but Host marks Absent     →  -5 pts (mismatch penalty)
 *  • Participant: NO (self-reported no-show)    →  -5 pts (immediate)
 *  • >50% vote NOT_CONDUCTED                   →  Host -10, activity CANCELLED
 *  • Host base reward for successful event      →  +5 pts
 *  • Host feedback (from verified attendees)    →  POSITIVE +2 | NEGATIVE -2
 *  • Host total gain is hard-capped at +10/event
 *  • All scores are clamped between 0 and 100
 */

const prisma = require("../config/db");

/** Ensure a value never goes below min or above max */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Update a user's trust score and record the change in the TrustLog table.
 * This function is called for both participants and hosts.
 */
const updateTrustScore = async (userId, points, action, activityId = null) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustScore: true },
  });
  if (!user) return;

  const newScore = clamp(user.trustScore + points, 0, 100);

  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: newScore },
  });

  // Keep an immutable audit trail of every score change
  const logData = { userId, action, pointsChange: points };
  if (activityId) logData.activityId = activityId;
  await prisma.trustLog.create({ data: logData });

  // Notify the user of the point change via in-app notification
  if (points !== 0) {
    const pointsStr = points > 0 ? `+${points}` : `${points}`;
    const notifData = {
      recipientId: userId,
      type: "REMINDER",
      title: `Trust Score ${points > 0 ? 'Increased' : 'Decreased'}`,
      message: `Your Trust Score changed by ${pointsStr} pts. Reason: ${action}`,
    };
    if (activityId) notifData.activityId = activityId;
    await prisma.notification.create({ data: notifData });
  }
};


/**
 * Participant submits their attendance vote.
 * Opens immediately when the activity's start time has passed.
 * Each participant can only vote once (enforced by the DB unique constraint).
 *
 * If the participant chooses NO_DID_NOT_ATTEND, the -5 penalty is applied
 * immediately — there is no waiting for the host roster.
 */
exports.submitVerification = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;
    const { choice, hostFeedback } = req.body;
    const userId = req.user.id;

    // --- Guards ---
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity)
      return res.status(404).json({ error: "Activity not found." });

    if (new Date() < activity.date) {
      return res.status(400).json({ error: "Activity has not started yet." });
    }

    // Hosts don't verify themselves — only regular members do
    const member = await prisma.activityMember.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (!member || activity.hostId === userId) {
      return res
        .status(403)
        .json({ error: "Only non-host members can submit a verification." });
    }

    // Prevent duplicate submissions
    const existing = await prisma.activityVerification.findUnique({
      where: {
        activityId_participantId: { activityId, participantId: userId },
      },
    });
    if (existing)
      return res
        .status(400)
        .json({ error: "You have already submitted your verification." });

    const validChoices = ["YES_ATTENDED", "NO_DID_NOT_ATTEND", "NOT_CONDUCTED"];
    if (!validChoices.includes(choice)) {
      return res.status(400).json({ error: "Invalid verification choice." });
    }

    // Host feedback is only accepted when the participant claims they attended
    const feedbackVal =
      choice === "YES_ATTENDED" && hostFeedback ? hostFeedback : null;

    // --- Save verification record ---
    const verification = await prisma.activityVerification.create({
      data: {
        activityId,
        participantId: userId,
        choice,
        hostFeedback: feedbackVal,
        finalStatus: "PENDING",
      },
    });

    // Immediate penalty for self-reported no-shows
    if (choice === "NO_DID_NOT_ATTEND") {
      await updateTrustScore(
        userId,
        -5,
        `Self-reported no-show: ${activity.title}`,
        activityId,
      );
      await prisma.activityVerification.update({
        where: { id: verification.id },
        data: { finalStatus: "MISSED" },
      });
    }

    res.json({ message: "Verification submitted.", verification });
  } catch (err) {
    next(err);
  }
};

/**
 * Host submits the final attendance roster. This is the single action that:
 *  - Checks if a majority voted NOT_CONDUCTED (→ host penalised, activity cancelled)
 *  - Cross-references each participant's vote with the host's mark
 *  - Distributes trust score changes to every participant
 *  - Calculates and caps the host's total reward
 *  - Marks the activity as COMPLETED
 */
exports.submitRoster = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;
    const hostId = req.user.id;
    const { roster } = req.body; // Array of { userId: string, attended: boolean }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { verifications: true },
    });

    if (!activity)
      return res.status(404).json({ error: "Activity not found." });
    if (activity.hostId !== hostId)
      return res
        .status(403)
        .json({ error: "Only the host can submit a roster." });
    if (new Date() < activity.date)
      return res.status(400).json({ error: "Activity has not started yet." });
    if (activity.status === "COMPLETED")
      return res.status(400).json({ error: "Activity is already completed." });

        // If more than half the verified participants say the activity never happened,
    // the host is penalised and the activity is cancelled with no further scoring.
    const totalVotes = activity.verifications.length;
    const notConductedVotes = activity.verifications.filter(
      (v) => v.choice === "NOT_CONDUCTED",
    ).length;

    if (totalVotes > 0 && notConductedVotes / totalVotes > 0.5) {
      await updateTrustScore(
        hostId,
        -10,
        `Failed to host (majority flag): ${activity.title}`,
        activityId,
      );
      await prisma.activity.update({
        where: { id: activityId },
        data: { status: "CANCELLED" },
      });
      return res.json({
        message:
          "Activity flagged as NOT CONDUCTED by majority. Host penalised -10 pts.",
        flagged: true,
      });
    }

        let hostFeedbackPoints = 0;

    for (const entry of roster) {
      const { userId, attended } = entry;
      if (userId === hostId) continue; // skip the host themselves

      const verification = activity.verifications.find(
        (v) => v.participantId === userId,
      );

      if (verification) {
        if (verification.choice === "YES_ATTENDED" && attended) {
          // ✅ MATCH — participant said yes and host confirms: reward participant
          await prisma.activityVerification.update({
            where: { id: verification.id },
            data: { hostMarkedAttended: true, finalStatus: "ATTENDED" },
          });
          await updateTrustScore(
            userId,
            2,
            `Verified attendance: ${activity.title}`,
            activityId,
          );

          // Collect host feedback points from this verified attendee
          if (verification.hostFeedback === "POSITIVE") hostFeedbackPoints += 2;
          if (verification.hostFeedback === "NEGATIVE") hostFeedbackPoints -= 2;
        } else {
          // ❌ MISMATCH — participant claimed they came, host says no (or v.v.)
          // Only penalise once; skip if already penalised for NO_DID_NOT_ATTEND
          if (verification.finalStatus !== "MISSED") {
            await updateTrustScore(
              userId,
              -5,
              `Marked absent by host: ${activity.title}`,
              activityId,
            );
          }
          await prisma.activityVerification.update({
            where: { id: verification.id },
            data: { hostMarkedAttended: false, finalStatus: "MISSED" },
          });
        }
      } else if (!attended) {
        // No vote submitted + host marks absent = silent no-show penalty
        await updateTrustScore(
          userId,
          -5,
          `No-show (no vote): ${activity.title}`,
          activityId,
        );
      }
    }

        // Base: +5 for successfully hosting. Add feedback sum. Cap total at +10.
    // If no participants actually attended, the host gets 0 points.
    const attendeesCount = roster.filter((entry) => entry.userId !== hostId && entry.attended).length;

    if (attendeesCount > 0) {
      const hostTotal = clamp(5 + hostFeedbackPoints, -10, 10);
      await updateTrustScore(
        hostId,
        hostTotal,
        `Hosted activity: ${activity.title}`,
        activityId,
      );
    }
    // If 0 attendees: host receives no points (no log entry needed)

    // Mark the activity as complete
    await prisma.activity.update({
      where: { id: activityId },
      data: { status: "COMPLETED" },
    });

    res.json({
      message: "Roster submitted. Scores updated. Activity completed.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Host fetches the full member list + their verification statuses.
 * Used to populate the HostRosterPage so the host can see who voted what
 * before marking everyone attended or absent.
 */
exports.getVerifications = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        members: {
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
        },
        verifications: {
          include: {
            participant: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
        },
      },
    });

    if (!activity)
      return res.status(404).json({ error: "Activity not found." });
    if (activity.hostId !== req.user.id)
      return res.status(403).json({ error: "Host access only." });

    res.json({
      activity,
      members: activity.members,
      verifications: activity.verifications,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Lets a participant check whether they have already submitted their vote.
 * Used by VerifyAttendancePage to show the "already submitted" state.
 */
exports.getMyVerification = async (req, res, next) => {
  try {
    const { id: activityId } = req.params;
    const userId = req.user.id;

    const verification = await prisma.activityVerification.findUnique({
      where: {
        activityId_participantId: { activityId, participantId: userId },
      },
    });

    res.json({ verification }); // null if not submitted yet
  } catch (err) {
    next(err);
  }
};
