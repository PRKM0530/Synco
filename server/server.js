const http = require("http");
const app = require("./app");
const config = require("./config");
const initializeSocket = require("./socket");

const PORT = config.port;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);
app.set("io", io);

server.listen(PORT, () => {
  console.log(`\n  🚀 Synco API running on http://localhost:${PORT}`);
  console.log(`  📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`  🌍 Environment: ${process.env.NODE_ENV || "development"}\n`);

  // PERFORMANCE: Keep-alive ping for Render free tier.
  // Render spins down free-tier services after ~15 min of inactivity,
  // causing a 30–50 s cold-start delay on the next request.
  // Pinging ourselves every 14 min keeps the server warm.
  if (process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === "production") {
    const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
    const selfUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
      try {
        await fetch(`${selfUrl}/api/health`);
        console.log("[Keep-Alive] Ping sent ✓");
      } catch (err) {
        console.warn("[Keep-Alive] Ping failed:", err.message);
      }
    }, KEEP_ALIVE_INTERVAL);
    console.log("  🏓 Keep-alive ping active (every 14 min)\n");
  }
});
