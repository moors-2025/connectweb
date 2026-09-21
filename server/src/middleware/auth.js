const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "token";

// The browser client authenticates with an httpOnly cookie (set on login/register,
// see routes/auth.js), which JavaScript in the page can never read — this is what
// keeps the token safe from theft via an XSS payload, unlike the old sessionStorage
// approach. The Authorization header is still accepted alongside it for non-browser
// API clients (and the automated test suite), so this is additive, not a breaking change.
function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, email }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// Decodes the token if present but never blocks the request — used for public
// routes that want to personalise the response (e.g. "have I already applied?")
// without requiring login.
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // invalid/expired token on an optional route: proceed unauthenticated
    }
  }
  next();
}

// Shared cookie options so login, register, and logout can't drift apart —
// mismatched options (path/sameSite/secure) are the classic reason clearCookie
// silently fails to clear a cookie that was set with different attributes.
const AUTH_COOKIE_NAME = COOKIE_NAME;
function authCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production, // required by browsers whenever sameSite is "none"
    sameSite: production ? "none" : "lax", // "none" because Vercel/Render are different origins
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matching the JWT's own expiry
  };
}

module.exports = {
  requireAuth,
  requireRole,
  optionalAuth,
  JWT_SECRET,
  AUTH_COOKIE_NAME,
  authCookieOptions,
};
