const express = require("express");
const { auth, adminOnly } = require("../middleware/auth");
const {
  getReports,
  resolveReport,
  banUser,
  unbanUser,
  getStats,
} = require("../controllers/admin.controller");

const router = express.Router();

// All admin routes require auth + ADMIN role
router.use(auth, adminOnly);

router.get("/stats", getStats);
router.get("/reports", getReports);
router.put("/reports/:id", resolveReport);
router.post("/users/:id/ban", banUser);
router.post("/users/:id/unban", unbanUser);

module.exports = router;
