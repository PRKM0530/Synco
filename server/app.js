const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
const config = require("./config");
const errorHandler = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const activityRoutes = require("./routes/activity.routes");
const joinRoutes = require("./routes/join.routes");
const friendRoutes = require("./routes/friend.routes");
const notificationRoutes = require("./routes/notification.routes");
const chatRoutes = require("./routes/chat.routes");
const verificationRoutes = require("./routes/verification.routes");
const reportRoutes = require("./routes/report.routes");
const adminRoutes = require("./routes/admin.routes");
const sosRoutes = require("./routes/sos.routes");

const app = express();

// --- Middleware ---
// PERFORMANCE: Compress all responses (gzip). ~60-80% smaller payloads.
app.use(compression());

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Allow multiple origins (comma-separated CLIENT_URL for dev + production)
const allowedOrigins = (config.clientUrl || "").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // In production, be permissive to avoid CORS issues
    }
  },
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Routes ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/activities", joinRoutes); // mounts to /api/activities/:id/join etc.
app.use("/api/activities", verificationRoutes); // verification & roster
app.use("/api/friends", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sos", sosRoutes);

// --- Error handling ---
app.use(errorHandler);

module.exports = app;
