const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const prisma = require("../config/db");
const config = require("../config");
const { sendOtpEmail } = require("../utils/email");

/** Generate a signed JWT for a given user ID. */
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};


/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, displayName } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        isVerified: false,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        isVerified: true,
      },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { email, token: otp, expiresAt },
    });

    await sendOtpEmail(email, otp);

    const token = generateToken(user.id);

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.isBanned) {
      return res
        .status(403)
        .json({ error: "Your account has been suspended." });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user.id);

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        profilePhoto: user.profilePhoto,
        role: user.role,
        isVerified: user.isVerified,
        trustScore: user.trustScore,
        bio: user.bio,
        interests: user.interests,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        interests: true,
        latitude: true,
        longitude: true,
        trustScore: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            hostedActivities: true,
            activityMembers: true,
          },
        },
        hostedActivities: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
        activityMembers: {
          take: 5,
          orderBy: { joinedAt: "desc" },
          include: {
            activity: true,
          },
        },
      },
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-email
 * Verifies email via OTP
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const record = await prisma.verificationToken.findFirst({
      where: { email, token: otp },
    });

    if (!record) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: "OTP expired" });
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    await prisma.verificationToken.deleteMany({
      where: { email },
    });

    res.json({ message: "Email verified successfully." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/resend-otp
 * Resend OTP to the user's email
 */
const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found." });
    
    // Clear old tokens
    await prisma.verificationToken.deleteMany({ where: { email } });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    await prisma.verificationToken.create({
      data: { email, token: otp, expiresAt },
    });
    
    await sendOtpEmail(email, otp);
    res.json({ message: "OTP resent successfully." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password/send-otp
 * Generate OTP for password reset
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Don't leak if user exists or not, but for our app returning a message is fine
      return res.status(404).json({ error: "User not found." });
    }
    
    await prisma.verificationToken.deleteMany({ where: { email } });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    await prisma.verificationToken.create({
      data: { email, token: otp, expiresAt },
    });
    
    await sendOtpEmail(email, otp, { isPasswordReset: true });
    res.json({ message: "Reset code sent to your email." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Verifies OTP and updates password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    
    const record = await prisma.verificationToken.findFirst({
      where: { email, token: otp },
    });
    
    if (!record) {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    
    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: "OTP expired" });
    }
    
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    
    await prisma.verificationToken.deleteMany({ where: { email } });
    res.json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, verifyEmail, resendOtp, forgotPassword, resetPassword };
