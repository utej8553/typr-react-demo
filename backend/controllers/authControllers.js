const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");

const JWT_SECRET  = process.env.JWT_SECRET  || "typr_dev_secret_change_in_prod";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

function signToken(userId, username) {
  return jwt.sign({ userId: String(userId), username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(u) {
  return {
    userId:    String(u._id),
    username:  u.username,
    email:     u.email,
    stats:     u.stats     || { races: 0, totalWpm: 0, maxWpm: 0, totalAccuracy: 0 },
    history:   u.history   || [],
    createdAt: u.createdAt,
  };
}

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: "All fields are required" });
    if (username.trim().length < 2)
      return res.status(400).json({ success: false, error: "Username must be at least 2 characters" });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, error: "Invalid email address" });

    const existingEmail    = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) return res.status(409).json({ success: false, error: "Email already registered" });

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) return res.status(409).json({ success: false, error: "Username already taken" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username:     username.trim(),
      email:        email.toLowerCase().trim(),
      passwordHash,
    });

    const token = signToken(user._id, user.username);
    return res.status(201).json({ success: true, token, user: safeUser(user) });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, error: "Email and password are required" });

    const user = await User.findOneDoc({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ success: false, error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, error: "Invalid email or password" });

    const token = signToken(user._id, user.username);
    return res.status(200).json({ success: true, token, user: safeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// GET /api/auth/profile  (requires auth middleware)
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    return res.status(200).json({ success: true, user: safeUser(user) });
  } catch (err) {
    console.error("getProfile error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// POST /api/auth/update-stats  (requires auth middleware)
const updateStats = async (req, res) => {
  try {
    const { wpm, accuracy } = req.body;
    if (wpm == null || accuracy == null)
      return res.status(400).json({ success: false, error: "wpm and accuracy are required" });

    const updated = await User.addRaceResult(req.userId, Number(wpm), Number(accuracy));
    if (!updated) return res.status(404).json({ success: false, error: "User not found" });

    return res.status(200).json({ success: true, user: safeUser(updated) });
  } catch (err) {
    console.error("updateStats error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// PATCH /api/auth/profile  (requires auth middleware) — update username
const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 2)
      return res.status(400).json({ success: false, error: "Username must be at least 2 characters" });

    const existing = await User.findOne({ username: username.trim() });
    if (existing && String(existing._id) !== String(req.userId))
      return res.status(409).json({ success: false, error: "Username already taken" });

    const updated = await User.updateUsername(req.userId, username.trim());
    if (!updated) return res.status(404).json({ success: false, error: "User not found" });

    const token = signToken(req.userId, updated.username);
    return res.status(200).json({ success: true, token, user: safeUser(updated) });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = { register, login, getProfile, updateStats, updateProfile };
