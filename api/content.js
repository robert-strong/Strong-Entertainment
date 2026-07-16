const { requireAuth, ghFetch, ghConfig, safeContentPath } = require('./_lib');

// GET /api/content?list=1          -> list editable content files
// GET /api/content?path=content/pages/index.json -> file content + sha
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    const { branch } = ghConfig();

    if (req.query.list) {
      const [rootItems, pageItems] = await Promise.all([
        ghFetch(`contents/content?ref=${branch}`),
        ghFetch(`contents/content/pages?ref=${branch}`),
      ]);
      const files = [...rootItems, ...pageItems]
        .filter(i => i.type === 'file' && i.name.endsWith('.json'))
        .map(i => ({ path: i.path, name: i.name }));
      return res.status(200).json({ files });
    }

    const p = req.query.path;
    if (!safeContentPath(p)) return res.status(400).json({ error: 'Invalid path' });
    const data = await ghFetch(`contents/${p}?ref=${branch}`);
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return res.status(200).json({ path: p, sha: data.sha, content: JSON.parse(content) });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
