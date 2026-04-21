/**
 * Shared email utility for sending OTP and transactional emails.
 * Uses SMTP credentials from environment or falls back to Ethereal test accounts.
 *
 * PERFORMANCE: The transporter is created once and cached as a module-level
 * singleton. Previously it was re-created on every send, adding 5–15 s of
 * SMTP handshake latency per email on free-tier hosts.
 */

const nodemailer = require("nodemailer");

/* ── Cached transporter singleton ──────────────────────────────────────── */
let cachedTransporter = null;
let cachedFromAddress = null;

/**
 * Build (or return the cached) authenticated Nodemailer transporter.
 * If real SMTP credentials exist in env, uses those; otherwise creates an
 * Ethereal test account.
 */
const getTransporter = async () => {
  if (cachedTransporter) {
    return { transporter: cachedTransporter, fromAddress: cachedFromAddress };
  }

  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

  if (smtpUser && smtpPass) {
    console.log(`[Synco Mail] Connecting to SMTP: ${smtpHost}:${smtpPort} as ${smtpUser}`);
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      // Keep the connection alive for reuse
      pool: true,
      maxConnections: 3,
      maxMessages: Infinity,
    });
    await transporter.verify();
    cachedTransporter = transporter;
    cachedFromAddress = smtpUser;
    console.log("[Synco Mail] SMTP transporter cached and verified ✓");
    return { transporter, fromAddress: smtpUser };
  }

  // Fallback: Ethereal test account (logs a preview URL to the console)
  console.log("[Synco Mail] No SMTP credentials found, using Ethereal test account");
  const account = await new Promise((resolve, reject) => {
    nodemailer.createTestAccount((err, acct) => {
      if (err) reject(err);
      else resolve(acct);
    });
  });

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });

  cachedTransporter = transporter;
  cachedFromAddress = null;
  return { transporter, fromAddress: null };
};

/**
 * Send an OTP email for verification or password reset.
 *
 * @param {string} email     — Recipient address
 * @param {string} otp       — 6-digit code
 * @param {Object} [options]
 * @param {boolean} options.isPasswordReset — Use password-reset copy instead of verification copy
 * @param {boolean} options.isEmailChange   — Use email-change copy
 */
const sendOtpEmail = async (email, otp, { isPasswordReset = false, isEmailChange = false } = {}) => {
  try {
    const { transporter, fromAddress } = await getTransporter();

    let subject, title, desc;
    if (isEmailChange) {
      subject = "Synco — Confirm Your New Email Address";
      title = "Confirm your new email";
      desc = "Use this code to confirm your new email on Synco:";
    } else if (isPasswordReset) {
      subject = "Synco — Reset Your Password";
      title = "Reset your Synco password";
      desc = "Use the code below to reset your password:";
    } else {
      subject = "Synco — Verify Your Email";
      title = "Verify your Synco account";
      desc = "Use the code below to verify your email address:";
    }

    const info = await transporter.sendMail({
      from: `Synco App <${fromAddress || "no-reply@synco.app"}>`,
      to: email,
      subject,
      text: `Your Synco code is: ${otp}\n\nThis code expires in 15 minutes.`,
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#2B4C8C;">${title}</h2>
          <p>${desc}</p>
          <div style="font-size:2rem;font-weight:700;letter-spacing:8px;color:#1a1a2e;background:#f0f4ff;padding:16px;border-radius:8px;text-align:center;">${otp}</div>
          <p style="color:#888;font-size:12px;margin-top:16px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    if (!fromAddress) {
      console.log("[Synco Mail] Ethereal preview:", nodemailer.getTestMessageUrl(info));
    } else {
      console.log(`[Synco Mail] Email sent to: ${email}`);
    }
  } catch (err) {
    console.error("[Synco Mail] Failed to send email:", err.message);
    // Invalidate cached transporter on error so it's rebuilt on next attempt
    cachedTransporter = null;
    cachedFromAddress = null;
  }
};

module.exports = { sendOtpEmail };
