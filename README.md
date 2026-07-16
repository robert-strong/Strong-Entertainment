# Strong-Entertainment

strongentertainment.com — website for Robert Strong (speaker, comedy magician, author),
migrated from Squarespace to a hand-maintainable static site deployed on Vercel.

## How it works

```
content/site.json          Site-wide settings: nav, contact info, social links, copyright
content/pages/*.json       One file per page — every heading, paragraph, image, video
assets/                    Stylesheet, JS, and all images
admin/index.html           The hidden /webmaster editor (password-protected)
api/                       Vercel serverless functions powering the editor
build.js                   Renders content JSON -> static HTML in dist/
```

`node build.js` reads the JSON content files and produces the finished site in `dist/`.
Vercel runs that automatically on every push to `main`.

Pages keep their original Squarespace URLs (`/keynote-speaker`, `/trade-show-magician`, …)
so existing links and SEO carry over when the domain is pointed at Vercel.

## Editing the site

Two ways:

1. **Webmaster editor (like Squarespace):** go to `https://<your-domain>/webmaster`,
   log in with the admin password, pick a page, edit, hit **Save & Publish**.
   The edit is committed to this repo and the live site rebuilds in about a minute.

2. **Directly in the repo:** edit any file in `content/`, commit, push. Same result.

To change photos: drop the new image into `assets/images/`, then set the image path
in the editor (e.g. `/assets/images/my-new-photo.jpg`).

## Local development

```bash
node build.js        # builds into dist/
npx serve dist       # preview at http://localhost:3000
```

No dependencies to install — the build is plain Node.

## Deploying on Vercel (one-time setup)

1. Import this GitHub repo at vercel.com/new (framework preset: **Other**).
   Build command and output dir are already set in `vercel.json`.
2. Add these Environment Variables in the Vercel project settings:

   | Name | Value |
   |------|-------|
   | `ADMIN_PASSWORD` | password for /webmaster (pick something long) |
   | `GITHUB_TOKEN` | fine-grained personal access token with **Contents: read/write** on this repo |
   | `GITHUB_REPO` | `robert-strong/Strong-Entertainment` |
   | `GITHUB_BRANCH` | `main` (optional, defaults to main) |

3. Point the `strongentertainment.com` domain at Vercel when ready
   (Project → Settings → Domains).

The `GITHUB_TOKEN` is created at github.com → Settings → Developer settings →
Fine-grained tokens → generate for only this repository with Read & Write access
to "Contents".

## Notes

- The original Squarespace page saves ("Strong Entertainment *.html" + `_files` folders)
  stay in the working folder locally as reference but are gitignored.
- The `/about` and `/contact-me` pages were not part of the Squarespace capture;
  those nav links currently point at the About and Contact sections of the home page.
- `robots.txt` disallows `/webmaster`, and the page carries a noindex header.
