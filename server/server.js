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
});
