import axios from "axios";

// In production (Netlify), use the full backend URL from env.
// In development, Vite proxies /api to localhost:5000.
const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("synco_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("synco_token");
      localStorage.removeItem("synco_user");
      // Only redirect if not already on auth pages
      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  verifyEmail: (data) => api.post("/auth/verify-email", data),
  getMe: () => api.get("/auth/me"),
  resendOtp: (data) => api.post("/auth/resend-otp", data),
  forgotPassword: (data) => api.post("/auth/forgot-password/send-otp", data),
  resetPassword: (data) => api.post("/auth/forgot-password/reset", data),
};

export const userAPI = {
  getProfile: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put("/users/me", data),
  uploadPhoto: (formData) =>
    api.post("/users/me/photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getTrustHistory: (id) => api.get(`/users/${id}/trust-history`),
  searchUsers: (q) => api.get(`/users/search`, { params: { q } }),
  deleteAccount: () => api.delete('/users/me'),
  requestEmailChange: (newEmail) => api.post('/users/me/request-email-change', { newEmail }),
  confirmEmailChange: (newEmail, otp) => api.post('/users/me/confirm-email-change', { newEmail, otp }),
};

export const activityAPI = {
  createActivity: (data) => api.post("/activities", data),
  getActivities: (params) => api.get("/activities", { params }),
  getMyActivities: (params) => api.get("/activities/mine", { params }),
  getActivityById: (id) => api.get(`/activities/${id}`),
  updateActivity: (id, data) => api.put(`/activities/${id}`, data),
  deleteActivity: (id) => api.delete(`/activities/${id}`),
  toggleCoHost: (activityId, memberUserId) =>
    api.put(`/activities/${activityId}/cohosts/${memberUserId}`),
  // Verification
  submitVerification: (activityId, choice, hostFeedback) =>
    api.post(`/activities/${activityId}/verify`, { choice, hostFeedback }),
  getMyVerification: (activityId) =>
    api.get(`/activities/${activityId}/my-verification`),
  getVerifications: (activityId) =>
    api.get(`/activities/${activityId}/verifications`),
  submitRoster: (activityId, roster) =>
    api.post(`/activities/${activityId}/roster`, { roster }),
};

// Join Requests & Membership API
export const joinAPI = {
  requestJoin: (activityId) => api.post(`/activities/${activityId}/join`),
  leaveActivity: (activityId) => api.delete(`/activities/${activityId}/leave`),
  kickParticipant: (activityId, userId) => api.delete(`/activities/${activityId}/kick/${userId}`),
  getRequests: (activityId) => api.get(`/activities/${activityId}/requests`),
  resolveRequest: (reqId, status) =>
    api.put(`/activities/requests/${reqId}`, { status }),
};

// Friend API
export const friendAPI = {
  getFriends: () => api.get("/friends"),
  addFriend: (userId) => api.post(`/friends/${userId}`),
  removeFriend: (userId) => api.delete(`/friends/${userId}`),
};

// Notification API
export const notificationAPI = {
  getNotifications: () => api.get("/notifications"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

// Chat API
export const chatAPI = {
  getActivityMessages: (activityId) =>
    api.get(`/chat/activities/${activityId}`),
  markChatRead: (activityId) => api.put(`/chat/activities/${activityId}/read`),
  pinMessage: (messageId) => api.put(`/chat/messages/${messageId}/pin`),
  deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
  getInbox: () => api.get("/chat/dms"),
  getDirectMessages: (friendId) => api.get(`/chat/dms/${friendId}`),
  markDMRead: (friendId) => api.put(`/chat/dms/${friendId}/read`),
  pinDMMessage: (messageId) => api.put(`/chat/dms/message/${messageId}/pin`),
  deleteDMMessage: (messageId) => api.delete(`/chat/dms/message/${messageId}`),
};

// Report API
export const reportAPI = {
  reportUser: (reportedUserId, reason, description) =>
    api.post("/reports", { reportedUserId, reason, description }),
};

// Admin API
export const adminAPI = {
  getStats: () => api.get("/admin/stats"),
  getReports: (status) => api.get("/admin/reports", { params: { status } }),
  resolveReport: (id, status, adminNotes) =>
    api.put(`/admin/reports/${id}`, { status, adminNotes }),
  banUser: (userId) => api.post(`/admin/users/${userId}/ban`),
  unbanUser: (userId) => api.post(`/admin/users/${userId}/unban`),
};

// SOS API
export const sosAPI = {
  create: (data) => api.post("/sos", data),
  deactivate: () => api.delete("/sos"),
  getMine: () => api.get("/sos/mine"),
  getActive: (params) => api.get("/sos/active", { params }),
  completeById: (id) => api.patch(`/sos/${id}/complete`),
  deleteById: (id) => api.delete(`/sos/${id}`),
};

export default api;
