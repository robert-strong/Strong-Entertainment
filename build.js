#!/usr/bin/env node
/**
 * Static site builder for strongentertainment.com
 * Renders content/*.json through the block renderer into dist/.
 * No dependencies — plain Node.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ---------- block renderers ----------
const render = {
  text: b => `<div class="prose">${b.html}</div>`,

  image: b => {
    const img = `<img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">`;
    const inner = b.href ? `<a href="${esc(b.href)}">${img}</a>` : img;
    const cap = b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : '';
    const style = b.width ? ` style="max-width:${b.width}px"` : '';
    return `<figure class="img-block"${style}>${inner}${cap}</figure>`;
  },

  button: b => `<a class="btn" href="${esc(b.href)}">${esc(b.text)}</a>`,

  video: b => `
    <div class="video-wrap"${b.width ? ` style="max-width:${b.width}px"` : ''}>
      <iframe src="https://www.youtube-nocookie.com/embed/${esc(b.youtubeId)}" title="YouTube video"
        loading="lazy" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe>
    </div>`,

  embed: b => `
    <div class="video-wrap">
      <iframe src="${esc(b.src)}" title="${esc(b.title || 'Embedded content')}" loading="lazy"
        frameborder="0" allowfullscreen></iframe>
    </div>`,

  accordion: b => `
    <div class="accordion">
      ${b.items.map(it => `
      <details>
        <summary>${esc(it.title)}</summary>
        <div class="accordion-body prose">${it.body}</div>
      </details>`).join('')}
    </div>`,

  gallery: b => {
    const items = b.images.map(i => `<figure><img src="${esc(i.src)}" alt="${esc(i.alt)}" loading="lazy"></figure>`).join('');
    return b.variant === 'slideshow' || b.variant === 'strip' || b.variant === 'reel'
      ? `<div class="gallery gallery--strip">${items}</div>`
      : `<div class="gallery">${items}</div>`;
  },

  cards: b => `
    <div class="cards">
      ${b.items.map(c => `
      <article class="card">
        <a class="card-media" href="${esc(c.href)}"><img src="${esc(c.image)}" alt="${esc(c.alt)}" loading="lazy"></a>
        <h3><a href="${esc(c.href)}">${esc(c.title)}</a></h3>
        <div class="prose">${c.html}</div>
      </article>`).join('')}
    </div>`,

  logos: () => marquee('companies-robert-has-performed-at.png', 'Companies Robert has performed for', 140, false),
  awards: () => marquee('robert-strong-top-magician-awards.png', 'Awards and recognition', 166, true),

  divider: () => '<hr class="divider">',
  anchor: b => `<span id="${esc(b.id)}" class="anchor"></span>`,
  _raw: b => b.html,
};

function marquee(img, label, height, reverse) {
  return `
    <div class="marquee${reverse ? ' marquee--reverse' : ''}" role="img" aria-label="${esc(label)}" style="--marquee-h:${height}px">
      <div class="marquee-track" style="background-image:url('/assets/images/${img}')"></div>
    </div>`;
}

function renderBlocks(blocks) {
  // Pre-pass: fold alternating [caption-text, small video/image] pairs (2+ in a row)
  // into captioned grid cells, matching the live site's multi-column media grids.
  const isSmallMedia = b => !!b && (b.type === 'video' || b.type === 'image') && b.width && b.width <= 640;
  const isCaption = b => !!b && b.type === 'text' && (b.html || '').length < 400;
  const folded = [];
  for (let i = 0; i < blocks.length;) {
    if (isCaption(blocks[i]) && isSmallMedia(blocks[i + 1]) &&
        isCaption(blocks[i + 2]) && isSmallMedia(blocks[i + 3])) {
      const cells = [];
      while (isCaption(blocks[i]) && isSmallMedia(blocks[i + 1])) {
        cells.push(`<div class="media-cell">${render.text(blocks[i])}${render[blocks[i + 1].type](blocks[i + 1])}</div>`);
        i += 2;
      }
      folded.push({ type: '_raw', html: `<div class="media-grid">${cells.join('')}</div>` });
      continue;
    }
    folded.push(blocks[i]);
    i++;
  }
  blocks = folded;

  // group runs of consecutive same-type blocks so side-by-side layouts survive:
  // buttons -> .btn-row; small images -> .img-row; small videos -> .video-grid
  const out = [];
  let run = [], runKind = null;
  const isSmallImg = b => b.type === 'image' && b.width && b.width <= 520;
  const isSmallVid = b => b.type === 'video' && b.width && b.width <= 640;
  const kindOf = b => b.type === 'button' ? 'btn' : isSmallImg(b) ? 'img' : isSmallVid(b) ? 'vid' : null;
  const flush = () => {
    if (!run.length) return;
    const inner = run.map(b => render[b.type](b)).join('');
    if (runKind === 'btn') out.push(`<div class="btn-row">${inner}</div>`);
    else if (run.length > 1) out.push(`<div class="${runKind === 'img' ? 'img-row' : 'video-grid'}">${inner}</div>`);
    else out.push(inner);
    run = []; runKind = null;
  };
  for (const b of blocks) {
    const k = kindOf(b);
    if (k) {
      if (runKind && runKind !== k) flush();
      runKind = k; run.push(b);
      continue;
    }
    flush();
    const fn = render[b.type];
    if (fn) out.push(fn(b));
    else console.warn('No renderer for block type:', b.type);
  }
  flush();
  return out.join('\n');
}

function renderSection(sec) {
  const id = sec.id ? ` id="${esc(sec.id)}"` : '';
  if (sec.theme === 'hero') {
    const bgStyle = sec.background ? ` style="background-image:url('${esc(sec.background)}')"` : '';
    const video = sec.backgroundVideo ? `
    <video class="hero-video" autoplay muted loop playsinline preload="metadata"${sec.background ? ` poster="${esc(sec.background)}"` : ''}>
      <source src="${esc(sec.backgroundVideo)}" type="video/mp4">
    </video>` : '';
    const overlayStyle = sec.overlay != null ? ` style="background:rgba(10,10,10,${Math.min(0.85, sec.overlay + 0.2)})"` : '';
    return `
  <section class="sec sec--hero"${id}${bgStyle}>${video}
    <div class="hero-overlay"${overlayStyle}></div>
    <div class="container hero-content">
      ${renderBlocks(sec.blocks)}
    </div>
  </section>`;
  }
  const wide = sec.blocks.some(b => ['gallery', 'cards', 'logos', 'awards'].includes(b.type));
  return `
  <section class="sec sec--${esc(sec.theme)}"${id}>
    <div class="container${wide ? ' container--wide' : ''}">
      ${renderBlocks(sec.blocks)}
    </div>
  </section>`;
}

// ---------- chrome ----------
function navHtml(current) {
  const item = n => {
    if (n.children) {
      return `
        <li class="nav-item nav-item--dropdown">
          <button class="nav-link nav-more" aria-expanded="false">${esc(n.label)} <span class="caret">▾</span></button>
          <ul class="dropdown">
            ${n.children.map(c => `<li><a class="nav-link" href="${esc(c.href)}"${/^https?:/.test(c.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(c.label)}</a></li>`).join('')}
          </ul>
        </li>`;
    }
    const active = n.href === '/' + current || (current === '' && n.href === '/');
    return `<li class="nav-item"><a class="nav-link${active ? ' is-active' : ''}" href="${esc(n.href)}">${esc(n.label)}</a></li>`;
  };
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a class="site-logo" href="/" aria-label="${esc(site.brand)} — home">
        <img src="${esc(site.logo)}" alt="${esc(site.brand)} logo">
      </a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="site-nav" aria-label="Main">
        <ul>${site.nav.map(item).join('')}</ul>
      </nav>
    </div>
  </header>`;
}

const SOCIAL_ICONS = {
  'facebook.com': ['Facebook', 'M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.3c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4V13h2.7v8h3.4z'],
  'instagram.com': ['Instagram', 'M12 7.4A4.6 4.6 0 1 0 16.6 12 4.6 4.6 0 0 0 12 7.4zm0 7.6a3 3 0 1 1 3-3 3 3 0 0 1-3 3zM17 5.9a1.1 1.1 0 1 0 1.1 1.1A1.1 1.1 0 0 0 17 5.9zM21.9 12c0-1.4 0-2.7-.1-3.5a5.6 5.6 0 0 0-1.5-4A5.6 5.6 0 0 0 16.4 3C15.6 3 14.4 3 13 3h-2c-1.4 0-2.7 0-3.5.1a5.6 5.6 0 0 0-4 1.5 5.6 5.6 0 0 0-1.4 4C2 9.3 2 10.6 2 12v.1c0 1.4 0 2.6.1 3.4a5.6 5.6 0 0 0 1.5 4 5.6 5.6 0 0 0 4 1.5c.8 0 2 .1 3.4.1h2c1.4 0 2.7 0 3.5-.1a5.6 5.6 0 0 0 4-1.5 5.6 5.6 0 0 0 1.4-4c0-.8.1-2 .1-3.4zm-1.7 0c0 1.4 0 2.6-.1 3.4a4 4 0 0 1-1 2.9 4 4 0 0 1-2.9 1c-.7 0-1.9.1-3.3.1h-1.9c-1.4 0-2.6 0-3.3-.1a4 4 0 0 1-2.9-1 4 4 0 0 1-1-2.9c-.1-.8-.1-2-.1-3.4v-.1c0-1.3 0-2.5.1-3.3a4 4 0 0 1 1-2.9 4 4 0 0 1 2.9-1c.7-.1 1.9-.1 3.3-.1h1.9c1.4 0 2.6 0 3.3.1a4 4 0 0 1 2.9 1 4 4 0 0 1 1 2.9c.1.8.1 2 .1 3.4z'],
  'youtube.com': ['YouTube', 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.4-4.8zM10 15.2V8.8L15.5 12z'],
  'linkedin.com': ['LinkedIn', 'M6.5 8.8H3.2V21h3.3zM4.9 3.2a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM21 13.6c0-3.2-1.7-4.9-4-4.9a3.5 3.5 0 0 0-3.2 1.7V8.8h-3.3V21h3.3v-6.4c0-1.7.8-2.7 2.2-2.7s2 1 2 2.7V21H21z'],
  'yelp.com': ['Yelp', 'M12.3 14.7l1.2 4.6a1 1 0 0 1-1.4 1.2l-4.3-2a1 1 0 0 1-.2-1.7l3.1-2.6a1 1 0 0 1 1.6.5zm1.7-.6l4.6 1.3a1 1 0 0 0 1.2-1.3l-1.8-4.4a1 1 0 0 0-1.7-.3L13.5 12a1 1 0 0 0 .5 1.7zm-.8-3.5L14.4 3a1 1 0 0 0-1.2-1.2L8.6 3a1 1 0 0 0-.6 1.6l3.5 6.3a1 1 0 0 0 1.7-.3z'],
  'default': ['Website', 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.4 9h-3.2a15.6 15.6 0 0 0-1.1-5.1A8 8 0 0 1 19.4 11zM12 4a13.7 13.7 0 0 1 2.2 7h-4.4A13.7 13.7 0 0 1 12 4zM4.6 13h3.2a15.6 15.6 0 0 0 1.1 5.1A8 8 0 0 1 4.6 13zm3.2-2H4.6a8 8 0 0 1 4.3-5.1A15.6 15.6 0 0 0 7.8 11zM12 20a13.7 13.7 0 0 1-2.2-7h4.4A13.7 13.7 0 0 1 12 20zm3.1-1.9a15.6 15.6 0 0 0 1.1-5.1h3.2a8 8 0 0 1-4.3 5.1z'],
};

function socialIcon(href) {
  const key = Object.keys(SOCIAL_ICONS).find(k => href.includes(k)) || 'default';
  const [label, d] = SOCIAL_ICONS[key];
  return `<a href="${esc(href)}" aria-label="${esc(label)}" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg></a>`;
}

function footerHtml() {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-social">${(site.social || []).map(socialIcon).join('')}</div>
      <p class="footer-contact">
        <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>
        &nbsp;·&nbsp; <a href="tel:${esc(site.contact.phone.replace(/[^+\d]/g, ''))}">${esc(site.contact.phone)}</a>
      </p>
      <p class="footer-copy">${esc(site.copyright)}</p>
    </div>
  </footer>`;
}

function pageHtml(page) {
  const canonical = site.domain + (page.slug ? '/' + page.slug : '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:type" content="website">
  <link rel="icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
${navHtml(page.slug)}
<main>
${page.sections.map(renderSection).join('\n')}
</main>
${footerHtml()}
<script src="/assets/js/main.js" defer></script>
</body>
</html>
`;
}

// ---------- build ----------
fs.mkdirSync(DIST, { recursive: true });
for (const entry of fs.readdirSync(DIST)) rmrf(path.join(DIST, entry));
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
fs.copyFileSync(path.join(ROOT, 'assets', 'images', 'favicon.ico'), path.join(DIST, 'favicon.ico'));

// admin editor -> /webmaster
copyDir(path.join(ROOT, 'admin'), path.join(DIST, 'webmaster'));

const pagesDir = path.join(ROOT, 'content', 'pages');
const pages = [];
for (const f of fs.readdirSync(pagesDir).filter(f => f.endsWith('.json'))) {
  const page = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
  pages.push(page);
  const outDir = page.slug ? path.join(DIST, page.slug) : DIST;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), pageHtml(page));
  console.log('built', page.slug || '(home)');
}

// 404
fs.writeFileSync(path.join(DIST, '404.html'), pageHtml({
  slug: '404', title: 'Page not found — ' + site.name, description: 'Page not found.',
  sections: [{ theme: 'light', blocks: [
    { type: 'text', html: '<h1>Page not found</h1><p>That page seems to have vanished — a good trick, but not the one you wanted.</p>' },
    { type: 'button', text: 'Back to home', href: '/' },
  ]}],
}));

// robots + sitemap
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /webmaster\n\nSitemap: ${site.domain}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map(p => `  <url><loc>${site.domain}${p.slug ? '/' + p.slug : ''}</loc></url>`).join('\n') +
  `\n</urlset>\n`);

console.log(`\nDone: ${pages.length} pages -> dist/`);
