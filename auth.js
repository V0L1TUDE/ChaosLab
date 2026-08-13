// ChaosLab — authentication (Phase 5)
//
// Two separate jobs live here, both using only Node's built-in `crypto`
// module (no bcrypt, no express-session, no extra dependencies):
//
//   1. Password hashing — we never store a password itself, only a
//      salted hash of it (scrypt). Even if chaoslab.db leaked, the
//      real passwords wouldn't be readable from it.
//
//   2. Sessions — after a correct login, the server hands the browser
//      a random, unguessable token in a cookie. Every request after
//      that includes the cookie automatically, and the server looks
//      the token up in `sessions` to know who's asking. Logging out
//      (or restarting the server) throws the token away, which is why
//      restarting the server logs everyone out — acceptable for a
//      project this size.

const crypto = require("crypto");

// ---- password hashing ----

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const suppliedBuffer = crypto.scryptSync(password, salt, 64);
  // timingSafeEqual (instead of ===) avoids leaking hash bytes via timing
  return hashBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(hashBuffer, suppliedBuffer);
}

// ---- sessions ----

const SESSION_COOKIE = "chaoslab_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory on purpose: sessions don't need to survive a server restart
// for a project this size, and it avoids adding a sessions table.
const sessions = new Map(); // token -> { userId, username, expiresAt }

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, username: user.username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(token) {
  sessions.delete(token);
}

// ---- cookies ----
// Hand-rolled on purpose (it's ~10 lines) instead of adding cookie-parser.

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; SameSite=Lax${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

// Express middleware — reject the request unless it carries a valid session.
function requireAuth(req, res, next) {
  const session = getSession(req.cookies[SESSION_COOKIE]);
  if (!session) {
    res.status(401).json({ implemented: true, message: "Not logged in." });
    return;
  }
  req.user = { id: session.userId, username: session.username };
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE,
};
