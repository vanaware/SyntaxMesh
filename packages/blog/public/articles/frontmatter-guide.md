---
title: "📝 Comprehensive Frontmatter & index.md Guide"
icon: "article"
date: "2026-11-08"
author: "mdBlog Team"
tags:
  - "frontmatter"
  - "index.md"
  - "markdown"
  - "navigation"
description: "Learn what to include in YAML frontmatter for mdBlog articles and how index.md configures global menus, full-text search, and brand settings."
location: "#/articles/frontmatter-guide.md"
pages:
  - "static-site-installation.md"
---

# 📝 Comprehensive Frontmatter & index.md Guide

In **mdBlog**, the **YAML Frontmatter** at the top of each Markdown document powers the site navigation. Unlike conventional static site generators that require centralized configuration files (such as `sidebar.json` or `_sidebar.md`), mdBlog discovers titles, dates, authors, icons, and nested page hierarchies dynamically from the Markdown files themselves.

---

## 🎯 The Special Role of `index.md`

The **`articles/index.md`** file is the mandatory root document of your blog or documentation site:

1. **First Document Loaded:** When a reader visits the site (on the root `#` URL or without a hash), mdBlog automatically fetches `./articles/index.md`.
2. **Top-Level Navigation Definition:** The frontmatter reader inspects the `pages:` list inside `index.md` to discover all top-level articles shown in the **Sidebar** and **Navbar**.
3. **Global Site Title and Icon:** The `siteTitle` and `siteIcon` properties can **only** be configured in `index.md`. They customize the brand mark displayed on the Navbar.
4. **Instant Full-Text Search:** Pages declared in `index.md` (and all recursive sub-pages) are indexed automatically into client-side `IndexedDB` (`idb-keyval`), powering the real-time search dialog (`Ctrl+K`).

---

## 📋 Recommended Frontmatter for `index.md`

Here is the standard example to place at the start of `articles/index.md`:

```yaml
---
title: "mdBlog - Blog & Static Documentation"
siteTitle: "My Documentation" # Global title shown in Navbar (EXCLUSIVE to index.md)
siteIcon: "menu_book"         # Global icon shown in Navbar (EXCLUSIVE to index.md)
description: "Modern static documentation engine built on Deno, Preact and BeerCSS."
date: "2026-11-08"
author: "Your Team"
location: "#/articles/index.md"
icon: "home"
tags:
  - "Deno"
  - "PWA"
  - "Documentation"
pages:
  - "static-site-installation.md"
  - "frontmatter-guide.md"
  - "overview.md"
  - "guide.md"
---

# 📖 Welcome to the Home Page

Your Markdown content starts here right below the `---` delimiters.
```

---

## 🔍 Supported Frontmatter Fields

You can use the following attributes inside the `---` YAML block:

| Field | Type | Scope | Description |
|---|---|---|---|
| `siteTitle` | `string` | **`index.md` only** | **Global site title** displayed in the top application bar (`Navbar`). Defaults to `"mdBlog"`. Ignored if present in child articles. |
| `siteIcon` | `string` | **`index.md` only** | **Global site icon** displayed in the Navbar (Material Symbols name, e.g. `menu_book`, `terminal`, `code`, `rocket_launch`). Defaults to `"menu_book"`. Ignored in other articles. |
| `title` | `string` | Any article (**Required**) | Specific article title displayed at the top of the content, in the sidebar menu, and in search results. |
| `description` | `string` | Recommended | Short descriptive summary. Used in search result cards and social previews. |
| `date` | `string` | Recommended | Publication or last update date (format: `YYYY-MM-DD`). |
| `author` | `string` | Optional | Author or team name responsible for the document. |
| `icon` | `string` | Optional | Material Symbols icon name for this individual article. If omitted, mdBlog infers a smart icon based on the file slug. |
| `badge` | `string` | Optional | Chip or badge text displayed next to the title (e.g. `New`, `v2.0`, `Beta`). |
| `location` | `string` | Optional | Explicit hash route (e.g. `#/articles/my-article.md`). Automatically inferred if omitted. |
| `tags` | `array` | Optional | List of tags or categories used for search indexing and categorization. |
| `pages` | `array` | Special | List of child sub-pages linked to this document (constructs nested navigation trees and breadcrumbs). |

---

## 🌳 Recursive Hierarchies and Sub-Pages with `pages:`

mdBlog supports **two formats** for declaring sub-pages in the `pages:` list:

### 1. Simple Format (Filenames only)
Recommended for most use cases. mdBlog loads each referenced file and extracts its title and icon directly from its own frontmatter:

```yaml
pages:
  - "static-site-installation.md"
  - "frontmatter-guide.md"
  - "advanced-topics.md"
```

### 2. Override Format (Explicit Metadata)
Allows specifying navigation titles or icons directly in the parent list:

```yaml
pages:
  - path: "static-site-installation.md"
    title: "Static Site Setup"
    icon: "install_desktop"
  - path: "frontmatter-guide.md"
    title: "Frontmatter Reference"
    icon: "edit_note"
```

### Nested Sub-Pages (Multiple Levels)
If a page referenced in `index.md` (e.g., `advanced-topics.md`) declares its own `pages:` block:

```yaml
---
title: "Advanced Topics"
pages:
  - "ast-security.md"
  - "service-worker-cache.md"
---
```

mdBlog automatically:
1. Renders the sidebar menu with **indentation proportional to the depth level** (`depth`).
2. Appends entries to the **breadcrumb trail** at the top of the reading pane.
3. Calculates previous and next document links at the bottom of the article.

---

## 🛡️ Best Practices

- **Lowercase ASCII Slugs:** Always save `.md` files using lowercase alphanumeric characters, dashes, dots, or underscores (e.g. `frontmatter-guide.md`). This avoids 404 errors on case-sensitive file systems and hosting providers (such as Linux containers and GitHub Pages).
- **No Raw HTML:** Avoid inserting `<script>` or unescaped HTML tags into Markdown. mdBlog converts documents into a secure Wire Format AST that discards raw script injections, providing built-in XSS protection.
- **ISO Date Format:** Use `YYYY-MM-DD` (e.g. `2026-11-08`) so dates format consistently across different browser locales.

---

## 🔗 Related Reading
- **[📦 How to Install mdBlog on Your Static Site](./static-site-installation.md)**: Directory structure, `index.html`, bundle `mdblog.js`, and BeerCSS.
