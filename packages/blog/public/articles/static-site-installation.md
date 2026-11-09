---
title: "📦 How to Install mdBlog on Your Static Site"
icon: "install_desktop"
date: "2026-11-08"
author: "mdBlog Team"
tags:
  - "installation"
  - "static-site"
  - "guide"
  - "configuration"
description: "Complete step-by-step guide to integrate mdBlog into static sites (GitHub Pages, Netlify, Vercel, S3, or Apache/Nginx)."
location: "#/articles/static-site-installation.md"
pages:
  - "frontmatter-guide.md"
---

# 📦 How to Install mdBlog on Your Static Site

**mdBlog** is designed to transform any static file server (GitHub Pages, Cloudflare Pages, Netlify, Vercel, AWS S3, Apache, Nginx, Caddy, or local dev) into a modern, responsive, and secure documentation and blog platform, without needing Node.js or a backend runtime on the host server.

This guide explains exactly which files you need to copy, the required folder structure, the minimal `index.html` file, and the necessary CDN dependencies (BeerCSS and Material Symbols fonts).

---

## 📂 Required Folder Structure and Files

At the root of your static site (or inside the subfolder where your blog is published), organize your files according to this tree:

```text
my-static-site/
├── index.html               # Main HTML entry point loading mdBlog and BeerCSS
├── mdblog.js                # Compiled library JavaScript bundle (from build dist)
├── sw.js                    # Service Worker for PWA caching and offline acceleration
├── manifest.json            # PWA Web App Manifest (optional, for mobile/desktop install)
├── icon.svg                 # Application icon and favicon
├── articles/                # 📁 MANDATORY folder where your Markdown articles live
│   ├── index.md             # Primary article loaded initially (the root of the blog)
│   ├── about.md             # Example individual article
│   └── docs/                # Can contain nested subfolders if desired
└── islands/                 # 📁 Folder containing interactive components (optional)
    ├── Counter.js           # Interactive Preact component (HTML+ES)
    └── DemoWidget.js
```

---

## 🛠️ Distribution Files (JavaScript Dist)

mdBlog generates two primary packaged files that you must include in your site:

1. **`mdblog.js` (or `mdblog.min.js`)**:
   - The primary ES Module bundle containing the CommonMark + GFM parser, the Wire Format AST pipeline, the Preact rendering engine, and the BeerCSS layout components.
   - Included in `index.html` via `<script type="module" src="./mdblog.js"></script>`.
   - If you are building from the repository or using the published JSR package (`@vanaware/mdblog`), copy the pre-built distribution artifact from `packages/server/build/dist/mdblog.js` or `packages/mdblog/dist/mdblog.min.js`.

2. **`sw.js` (Service Worker)**:
   - Manages offline PWA caching and intercepts documentation requests directed at `./articles/`, enabling offline reading and instantaneous transitions.
   - Place this file at the root of your application so its scope covers all relative paths.

---

## 🌐 The Minimal `index.html` File

Here is the official, clean `index.html` template to place at the root of your site:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Blog / Documentation</title>
    <meta name="description" content="Static documentation powered by mdBlog" />

    <!-- Web App Manifest (PWA) -->
    <link rel="manifest" href="./manifest.json" />

    <!-- Favicon -->
    <link rel="icon" href="./icon.svg" />

    <!-- 1. BeerCSS Stylesheet (Pure Material Design 3 without Tailwind) -->
    <link
      href="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/beer.min.css"
      rel="stylesheet"
    />

    <!-- 2. Material Symbols Outlined font (Preloading improves initial paint) -->
    <link
      rel="preload"
      href="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/material-symbols-outlined.woff2"
      as="font"
      type="font/woff2"
      crossorigin
    />

    <!-- 3. BeerCSS Scripts and Dynamic Colors -->
    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/beer.min.js"
    ></script>
    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.2/dist/cdn/material-dynamic-colors.min.js"
    ></script>
  </head>
  <body class="auto">
    <!-- mdBlog application mount container -->
    <div id="app"></div>

    <!-- Main mdBlog bundle (automatically starts router and registers Service Worker) -->
    <script type="module" src="./mdblog.js"></script>
  </body>
</html>
```

### Why BeerCSS?
mdBlog exclusively utilizes the **BeerCSS (Material Design 3)** framework. You do not need to write custom CSS or install complex build toolchains like Tailwind, Sass, or PostCSS. The user interface relies purely on BeerCSS semantic HTML tags and standard utility classes.

---

## ⚙️ The `articles/` Folder and the `index.md` File

- **Location:** Create the `articles/` directory at the same level as `index.html`.
- **Initial Document:** mdBlog immediately requests **`./articles/index.md`** when the site opens.
- **Hash-Based Routing:** Every Markdown article automatically maps to an addressable hash route (for example, `#/articles/index.md`, `#/articles/about.md`).
- **Dynamic Navigation:** No manual HTML menus are needed. mdBlog inspects the `pages:` list declared in the frontmatter of `index.md` and renders the Sidebar, Navbar, and breadcrumb trails at runtime in the browser.

---

## 🏝️ Interactive Components (`islands/`)

If you want to add reactive elements (calculators, interactive demos, widgets) directly inside your Markdown:

1. Create an `islands/` directory at the site root.
2. Add components as native `.js` ES modules (HTML+ES with `htm/preact` and `@preact/signals`).
3. In your Markdown, invoke the island using directive or code block syntax:
   ```markdown
   ::MyWidget.js{prop: "value"}
   ```

---

## 🚀 Publishing and Hosting

Because all asset and routing paths in mdBlog are resolved relatively (`./`), your site works out of the box:
* **At domain root:** `https://mysite.com/`
* **Inside subfolders (such as GitHub Pages):** `https://username.github.io/my-repo/`
* **Locally:** Using any static web server (e.g. `python3 -m http.server`, `npx serve`, or `deno run --allow-net --allow-read jsr:@std/http/file-server`).

---

## ➡️ Next Steps

Learn how to structure article metadata and navigate nested sub-pages in detail:
- **[📝 Comprehensive Frontmatter & `index.md` Guide](./frontmatter-guide.md)**
