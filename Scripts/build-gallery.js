// Reads photos/<Folder>/ and writes gallery.json. Runs automatically on GitHub (see .github/workflows).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PHOTOS = path.join(ROOT, 'photos');
const IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const clean = s => s.replace(/^\d+[-_ ]+/, '');                       // "01-Bali" -> "Bali"
const slug = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'folder';
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };

const dirs = fs.existsSync(PHOTOS)
  ? fs.readdirSync(PHOTOS, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name).sort(nat)
  : [];

const folders = [];
for (const dir of dirs) {
  const base = path.join(PHOTOS, dir);
  const meta = readJson(path.join(base, 'folder.json'));
  let files = fs.readdirSync(base).filter(f => IMG.test(f)).sort(nat);
  if (!files.length) continue;
  // Cover = "cover" setting in folder.json, else a file named cover.*, else the first photo.
  const cover = files.includes(meta.cover) ? meta.cover : files.find(f => /^cover\./i.test(f)) || files[0];
  files = [cover, ...files.filter(f => f !== cover)];
  const captions = meta.captions || {};
  const rawTags = Array.isArray(meta.tags) ? meta.tags : String(meta.tags || '').split(',');
  const tags = [...new Set(rawTags.map(t => String(t).trim()).filter(Boolean))];
  folders.push({
    slug: slug(dir), dir, name: meta.title || clean(dir), description: meta.description || '', tags,
    photos: files.map(file => ({ file, caption: captions[file] || '' }))
  });
}
fs.writeFileSync(path.join(ROOT, 'gallery.json'), JSON.stringify({ folders }, null, 2));
console.log(`gallery.json: ${folders.length} folder(s), ${folders.reduce((n, f) => n + f.photos.length, 0)} photo(s)`);
