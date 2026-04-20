const jwt = require("jsonwebtoken");
const config = require("../config");
const prisma = require("../config/db");

/**
 * Authentication middleware — verifies JWT from Authorization header
 * Attaches user object to req.user
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        profilePhoto: true,
        role: true,
        isVerified: true,
        isBanned: true,
        trustScore: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    if (user.isBanned) {
      return res
        .status(403)
        .json({ error: "Your account has been suspended." });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
};

/**
 * Optional Authentication middleware — attempts to verify JWT
 * Attaches user to req.user if a valid token exists, but doesn't throw 401 if not.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        profilePhoto: true,
        role: true,
        isVerified: true,
        isBanned: true,
        trustScore: true,
      },
    });

    if (user && !user.isBanned) {
      req.user = user;
    }
    next();
  } catch (err) {
    // If token is invalid/expired, still allow access as an unauthenticated user
    next();
  }
};

/**
 * Admin-only middleware — must be used after auth middleware
 */
const adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
};

module.exports = { auth, optionalAuth, adminOnly };
