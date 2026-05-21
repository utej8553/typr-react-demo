const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "typr_dev_secret_change_in_prod";

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers["authorization"] || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId   = payload.userId;
    req.username = payload.username;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
};
