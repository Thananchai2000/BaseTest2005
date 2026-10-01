// Zero-dependency server: static files + login (scrypt, session cookie) + factory API.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const factory = require('./lib/factory');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes idle

// ---------- users ----------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // First run: create a demo admin account (see README). Change it with scripts/adduser.js.
    const { salt, hash } = hashPassword('factory2005');
    const users = { admin: { salt, hash, role: 'Administrator', name: 'System Administrator' } };
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Created data/users.json with the demo account described in README.md');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function verifyPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// ---------- sessions ----------
const sessions = new Map(); // token -> { username, expires }

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const m = /(?:^|;\s*)sid=([a-f0-9]{64})/.exec(cookie);
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s || s.expires < Date.now()) { sessions.delete(m[1]); return null; }
  s.expires = Date.now() + SESSION_TTL;
  return { token: m[1], ...s };
}

// ---------- login throttling ----------
const attempts = new Map(); // ip -> { count, resetAt }
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) return false;
  return a.count >= 5;
}
function recordFailure(ip) {
  const a = attempts.get(ip);
  if (!a || a.resetAt < Date.now()) attempts.set(ip, { count: 1, resetAt: Date.now() + 5 * 60 * 1000 });
  else a.count++;
}

// ---------- helpers ----------
function sendJson(res, status, obj, headers) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers));
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10000) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.png': 'image/png',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml'
};

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- server ----------
const users = loadUsers();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = req.socket.remoteAddress;

  try {
    if (req.method === 'POST' && url.pathname === '/api/login') {
      if (tooManyAttempts(ip)) return sendJson(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      const { username, password } = await readJson(req);
      const user = typeof username === 'string' && Object.prototype.hasOwnProperty.call(users, username) ? users[username] : null;
      // Always hash once so timing doesn't reveal whether the user exists.
      const ok = user ? verifyPassword(user, String(password || '')) : (hashPassword('x', '00'), false);
      if (!ok) { recordFailure(ip); return sendJson(res, 401, { error: 'Invalid username or password.' }); }
      attempts.delete(ip);
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { username, expires: Date.now() + SESSION_TTL });
      return sendJson(res, 200, { ok: true }, {
        'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const s = getSession(req);
      if (s) sessions.delete(s.token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }

    if (url.pathname.startsWith('/api/')) {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { error: 'Not logged in.' });
      if (url.pathname === '/api/me') {
        const u = users[s.username];
        return sendJson(res, 200, { username: s.username, name: u.name, role: u.role });
      }
      if (url.pathname === '/api/factory') return sendJson(res, 200, factory.snapshot());
      return sendJson(res, 404, { error: 'Unknown endpoint.' });
    }

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

    // Protect the dashboard page itself, not just its data.
    if (url.pathname === '/dashboard.html' && !getSession(req)) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (e) {
    sendJson(res, 400, { error: 'Bad request.' });
  }
});

server.listen(PORT, () => console.log(`Factory portal running at http://localhost:${PORT}`));
