import { io } from "socket.io-client";

// Connect to the same host+port the page was loaded from.
// Vite proxies /socket.io → http://localhost:5000, so this works for:
//   - Local users:  connects via Vite proxy to localhost:5000
//   - Remote users via port-forward: their browser sends /socket.io to
//     the forwarded host, Vite's proxy on that machine routes it to the backend.
//
// We use window.location.origin so the URL always matches whoever opened the page.
const SOCKET_URL = window.location.origin;

let socket;

export const initSocket = () => {
  if (socket) return socket;

  const token = localStorage.getItem("synco_token");

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    path: "/socket.io",
  });

  socket.on("connect", () => {
    console.log("🔌 Connected to Socket.IO Server:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.warn("🔌 Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("🔌 Socket Connection Error:", err.message);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
