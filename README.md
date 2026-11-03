# Photo Wall

A minimal photo gallery for GitHub Pages. Each folder in `photos/` becomes a stack on the homepage.

## Set up (once)
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. **Settings → Pages**: Source = "Deploy from a branch", Branch = `main`, folder = `/ (root)`.
3. **Settings → Actions → General → Workflow permissions**: choose "Read and write permissions".
4. Your site appears at `https://<username>.github.io/<repo>/`.

## Add photos
1. In the repository, open `photos` → **Add file → Upload files**.
2. Drag in a whole folder of images (the folder name becomes the stack name; prefix with numbers like `01-Bali` to control the order).
3. Commit. After about a minute the stack appears on the site.

## Descriptions, captions and cover (optional)
Add a file named `folder.json` inside the folder:

```json
{
  "title": "Ubud Mornings",
  "description": "Early walks before the heat.",
  "cover": "morning-mist.jpg",
  "tags": ["Bali", "Travel"],
  "captions": { "morning-mist.jpg": "Morning mist" }
}
```

- `cover`: the photo on top of the stack. Without it, a file named `cover.jpg` (any image type) is used, then the first photo.
- `tags`: labels for the folder. The homepage shows a filter bar with every tag you use (click one to show only those folders), and each tag also appears under the folder's description. Tags are case-insensitive, so "Bali" and "bali" are the same filter.
- Everything is optional. Edit the file on GitHub any time; the site updates after the commit.

## Using the homepage
The homepage is a wall you can move around: drag to pan, pinch with two fingers to zoom (on a computer: Ctrl + scroll, or the + / − buttons). **Fit** brings every folder back into view. On phones it opens zoomed out so you see the whole wall, like on a computer.

## Tips
- Resize photos to about 2000 px on the long side before uploading so the site loads quickly.
- To rename the site, edit the first two lines of `app.js`.
