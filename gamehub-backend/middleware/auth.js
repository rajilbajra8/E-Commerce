const jwt = require("jsonwebtoken");

// Falls back to a dev secret so the app still boots without a .env entry,
// but you should always set JWT_SECRET in production.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

// Verifies the token and attaches the decoded user to req.user
function verifyToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No token provided. Please log in again.",
        });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token. Please log in again.",
        });
    }
}

// Must be used AFTER verifyToken
function verifyAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required.",
        });
    }
    next();
}

module.exports = { verifyToken, verifyAdmin, JWT_SECRET };
