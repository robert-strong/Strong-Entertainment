const { requireAuth, ghFetch, ghConfig, safeContentPath } = require('./_lib');

// POST /api/save { path, content (object), sha }
// Commits the updated JSON to GitHub; Vercel redeploys automatically.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  const { path: p, content, sha } = req.body || {};
  if (!safeContentPath(p)) return res.status(400).json({ error: 'Invalid path' });
  if (content == null || typeof content !== 'object') {
    return res.status(400).json({ error: 'Content must be a JSON object' });
  }

  try {
    const { branch } = ghConfig();
    const body = {
      message: `content: update ${p} via webmaster editor`,
      content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'),
      branch,
    };
    if (sha) body.sha = sha;
    const result = await ghFetch(`contents/${p}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    return res.status(200).json({ ok: true, sha: result.content.sha, commit: result.commit.sha });
  } catch (e) {
    const conflict = /GitHub 409|does not match/.test(e.message);
    return res.status(conflict ? 409 : 502).json({
      error: conflict
        ? 'This page changed since you loaded it. Reload the page and re-apply your edit.'
        : e.message,
    });
  }
};
