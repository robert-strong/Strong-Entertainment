// Shared helpers for the webmaster API (Vercel serverless functions).
const crypto = require('crypto');

const COOKIE = 'se_admin';
const SESSION_HOURS = 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_PASSWORD env var is not set');
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionCookie(token, maxAgeSec) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
}

function requireAuth(req, res) {
  const payload = verify(getCookie(req, COOKIE));
  if (!payload) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return payload;
}

function newSession() {
  return sign({ role: 'admin', exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
}

// ---- GitHub content API ----
function ghConfig() {
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!repo || !token) throw new Error('GITHUB_REPO / GITHUB_TOKEN env vars are not set');
  return { repo, token, branch };
}

async function ghFetch(path, options = {}) {
  const { repo, token } = ghConfig();
  const res = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'strong-entertainment-webmaster',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function safeContentPath(p) {
  // Only content/*.json may be read or written through the editor.
  return typeof p === 'string'
    && /^content\/(pages\/)?[a-z0-9-]+\.json$/.test(p);
}

module.exports = {
  COOKIE, sign, verify, getCookie, sessionCookie, requireAuth, newSession,
  ghConfig, ghFetch, safeContentPath, SESSION_HOURS,
};
