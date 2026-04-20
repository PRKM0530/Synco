/**
 * socket.js
 * Initialises the Socket.IO server and wires up all real-time events.
 *
 * Two channel types are supported:
 *  1. Activity Group Chat  — room name: `activity_<activityId>`
 *     Members and the host can send, delete, and pin messages.
 *
 *  2. Direct Messages (DMs) — room name: `dm_<userId1>_<userId2>` (sorted)
 *     A private channel between any two users.
 *
 * All socket connections are authenticated via the same JWT that the
 * REST API uses. An invalid or missing token disconnects the socket.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("./config");
const prisma = require("./config/db");

/**
 * Attach Socket.IO to the existing HTTP server and return the `io` instance
 * so that REST controllers can emit events (e.g. push notifications) later.
 */
const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
    },
  });

    io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: token missing."));

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.user = { id: decoded.userId, ...decoded };
      next();
    } catch {
      next(new Error("Authentication error: invalid or expired token."));
    }
  });

    io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.user.id})`);

    // Auto-join personal room for targeted notifications
    socket.join(`user_${socket.user.id}`);

        socket.on("join-activity-room", async (activityId) => {
      try {
        const [activity, member] = await Promise.all([
          prisma.activity.findUnique({ where: { id: activityId } }),
          prisma.activityMember.findUnique({
            where: {
              activityId_userId: { activityId, userId: socket.user.id },
            },
          }),
        ]);

        if (!activity) {
          console.warn(`❌ join-activity-room: activity ${activityId} not found`);
          return;
        }

        const isHostOrMember = member || activity?.hostId === socket.user.id;
        if (!isHostOrMember) {
          console.warn(`❌ Unauthorised room join by user ${socket.user.id} for activity ${activityId}`);
          return;
        }

        socket.join(`activity_${activityId}`);
        console.log(`🟢 User ${socket.user.id} joined activity_${activityId}`);
      } catch (err) {
        console.error("join-activity-room error:", err.message);
      }
    });


    /** leave-activity-room — called when the user navigates away */
    socket.on("leave-activity-room", (activityId) => {
      socket.leave(`activity_${activityId}`);
    });

    /**
     * send-activity-message
     * Persists the message to the database, then broadcasts it to all room members.
     * The ChatRoom is lazily created on the first message if it doesn't exist yet.
     */
    socket.on("send-activity-message", async ({ activityId, content }) => {
      console.log(`💬 Processing activity message from ${socket.user.id} to room activity_${activityId}`);
      try {
        // Lazily create the ChatRoom if this is the first message
        let chatRoom = await prisma.chatRoom.findUnique({
          where: { activityId },
        });
        if (!chatRoom) {
          chatRoom = await prisma.chatRoom.create({ data: { activityId } });
        }

        const message = await prisma.chatMessage.create({
          data: { roomId: chatRoom.id, senderId: socket.user.id, content },
          include: {
            sender: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
        });

        // Broadcast to everyone in the room (including the sender for echo)
        io.to(`activity_${activityId}`).emit(
          "receive-activity-message",
          message,
        );
      } catch (err) {
        console.error("send-activity-message error:", err);
      }
    });

    /** delete-activity-message — broadcast deletion event, client removes from UI */
    socket.on("delete-activity-message", ({ activityId, messageId }) => {
      io.to(`activity_${activityId}`).emit("message-deleted", messageId);
    });

    /** pin-activity-message — broadcast pin toggle to the room */
    socket.on("pin-activity-message", ({ activityId, messageId, isPinned }) => {
      io.to(`activity_${activityId}`).emit("message-pinned", {
        messageId,
        isPinned,
      });
    });

        /**
     * join-dm-room
     * Room name is deterministic: sort both user IDs alphabetically and join
     * with underscore so both sides always end up in the same room.
     */
    socket.on("join-dm-room", (friendId) => {
      const roomName = `dm_${[socket.user.id, friendId].sort().join("_")}`;
      socket.join(roomName);
    });

    /**
     * send-dm-message
     * Persists the DM then emits it to the private room so both users
     * see the message in real time.
     */
    socket.on("send-dm-message", async ({ receiveId, content }) => {
      try {
        const message = await prisma.directMessage.create({
          data: { senderId: socket.user.id, receiverId: receiveId, content },
          include: {
            sender: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
        });

        const roomName = `dm_${[socket.user.id, receiveId].sort().join("_")}`;
        io.to(roomName).emit("receive-dm-message", message);
      } catch (err) {
        console.error("send-dm-message error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initializeSocket;
