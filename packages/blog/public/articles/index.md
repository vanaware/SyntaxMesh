---
title: "SyntaxMesh Documentation"
siteTitle: "SyntaxMesh"
siteIcon: "menu_book"
description: "SyntaxMesh Blog"
date: "2026-11-08"
author: "SyntaxMesh Team"
location: "#/articles/index.md"
tags:
  - "doc"
pages:
  - "static-site-installation.md"
  - "frontmatter-guide.md"
  - "islands.md"
---

# 📖 SyntaxMesh — Documentation

Welcome to ...

---

## 🚀 Featured Articles

Browse the guides and technical documentation available:

- **[📦 How to Install mdBlog on Your Static Site](./static-site-installation.md)**: Required files, directory layout, `mdblog.js` bundle, and BeerCSS CDN setup.
- **[📝 Comprehensive Frontmatter & index.md Guide](./frontmatter-guide.md)**: Supported fields, hierarchical navigation trees, and site title/icon branding.
- **[🏝️ Islands Guide](./islands.md)**: Manual on-demand client-side selective hydration.

---

## 🌳 Hierarchical Structure and Sub-pages

mdBlog supports **nested recursive sub-pages** discovered straight from the
frontmatter:

1. **Root page (`index.md`)**: declares the main sections in the `pages:` list.
2. **Main pages**: each page (e.g. `overview.md`) may carry its own `pages:` list of sub-pages (e.g. `wire-format.md`).
3. **Sub-sub-pages**: a sub-page can also declare `pages:` (e.g. `wire-schema.md`), allowing several levels of depth.
4. **Sidebar and drawer navigation**: sub-pages show up cleanly indented in the side menu, and the breadcrumb trail at the top follows them.

---

## 🛠 How to Publish New Articles or Sub-pages

1. Add a new `.md` file to the `public/articles/` folder (e.g. `public/articles/my-article.md`) with its own frontmatter block (`title`, `icon`, `date`, `tags`, etc.).
2. Add the file name to the `pages:` list of the parent page where you want it to appear.
3. The browser discovers the hierarchy at runtime and updates the Navbar, Sidebar and breadcrumbs automatically, with no recompilation.
