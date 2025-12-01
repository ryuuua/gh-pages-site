## Plotpages GitHub Pages Build

This directory is a self-contained, publishable version of the gallery that only ships a
handful of representative plots, making it small enough to commit to a GitHub Pages
repository.

### Structure

```
gh-pages-site/
├── index.html                     # Gallery entry point
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   └── gallery.css
│   ├── data/
│   │   └── gallery-data.json      # Manifest that points to ./public_gallery/*
│   └── js/
│       └── gallery.js             # Frontend logic (same as main project)
└── public_gallery/                # Copied subset of images for publishing
```

### Regenerating the subset

From the root project (`/Users/ryua/code/plotpages`) run:

```bash
PUBLIC_GALLERY_INCLUDE="daircos:all-MiniLM-L6-v2_plot,daircos:google:embeddinggemma-300M_plot" \
PUBLIC_GALLERY_MAX_ITEMS=6 \
node scripts/create-public-gallery.js

# Refresh this directory after regeneration:
rm -rf gh-pages-site/public_gallery
cp -R public_gallery gh-pages-site/public_gallery
cp assets/data/gallery-data.public.json gh-pages-site/assets/data/gallery-data.json
```

Adjust the environment variables for different category filters or limits.

### Publishing workflow

1. `cd gh-pages-site`
2. `git init` (only once) and add your GitHub remote (e.g. `git remote add origin git@github...`)
3. Keep the provided `.nojekyll` file so GitHub Pages serves files with colons (`daircos:...`) as-is without trying to run Jekyll.
4. `git add . && git commit -m "Initial GitHub Pages build"`
5. Push to the branch that backs GitHub Pages (`main`, `master`, or `gh-pages` depending on repo settings)
6. Enable Pages for that branch in your GitHub repository settings

You can also copy this directory to another repo entirely if you prefer to keep the
lightweight site separate from the full dataset.

### Local preview

Before pushing, verify the static bundle with any simple HTTP server so that `fetch` works:

```bash
cd gh-pages-site
python3 -m http.server 4173
# visit http://localhost:4173
```

The gallery reads `assets/data/gallery-data.json`, so keep that manifest in sync with the
contents of `public_gallery/` whenever you regenerate the subset.

### Customizing badges/tags

Each gallery item renders the badge (`span.gallery-item-type`) from the manifest. By default it
falls back to the file type (PNG/HTML), but you can override it to show dataset names, embedding
models, or CEBRA settings:

```json
{
  "categories": [
    {
      "name": "daircos:all-MiniLM-L6-v2_plot",
      "meta": {
        "dataset": "daircos (CEBRA_NLP)",
        "embeddingModel": "all-MiniLM-L6-v2",
        "cebra": "sigma=0.8 / static PCA"
      },
      "items": [
        {
          "file": "static_PCA_plot 2.png",
          "title": "static PCA plot 2",
          "type": "image",
          "tag": "Dataset A / MiniLM / CEBRA sigma=0.8"
        }
      ]
    }
  ]
}
```

Precedence is `item.tag` → `item.meta.tag` → `category.tag` → formatted `meta` fields → folder structure
→ file type. If you skip all meta fields, the badge automatically uses the last three segments of the
path (e.g. `datasets/embeddingmodel/CEBRAsetting` becomes `datasets / embeddingmodel / CEBRAsetting`).
Edit `assets/data/gallery-data.json` manually to set whichever string you prefer for each badge, or
rely on your directory hierarchy for automatic labels.

