import { io } from "socket.io-client";

// In production, the socket server is on a different domain (Render).
// In development, Vite proxies /socket.io to localhost:5000.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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
