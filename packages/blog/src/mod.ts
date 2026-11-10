/// <reference lib="deno.ns" />
/**
 * Content Generator for mdBlog - Creates markdown files for blog posts
 *
 * This package generates structured markdown content for blog articles
 * based on predefined templates and content inputs.
 *
 * @package content-generator
 * @version 0.1.0
 */

import { mkpath, print, writeText, } from "./io.ts";

/**
 * All supported YAML frontmatter fields for mdBlog articles.
 *
 * Reference: `packages/blog/public/articles/frontmatter-guide.md`
 *
 * | Field      | Type    | Scope              | Description |
 * |------------|---------|--------------------|-------------|
 * | `siteTitle` | string  | `index.md` only    | Global site title in the Navbar. Ignored in child articles. |
 * | `siteIcon`  | string  | `index.md` only    | Global site icon (Material Symbols name). Ignored in child articles. |
 * | `title`     | string  | Any article        | Required. Article title, sidebar label, search result. |
 * | `description`| string  | Recommended        | Short summary for search cards and social previews. |
 * | `date`      | string  | Recommended        | Publication or last update date (`YYYY-MM-DD`). |
 * | `author`    | string  | Optional           | Author or team name. |
 * | `icon`      | string  | Optional           | Material Symbols icon name. Inferred from slug if omitted. |
 * | `badge`     | string  | Optional           | Chip/badge text next to the title (e.g. `New`, `v2.0`). |
 * | `location`  | string  | Optional           | Explicit hash route (e.g. `#/articles/my-article.md`). |
 * | `tags`      | string[]| Optional           | Tags or categories for search indexing and categorization. |
 * | `pages`     | string[]| Special            | List of child sub-pages (constructs nested navigation trees). |
 */
export interface FrontmatterOptions {
  title: string;
  date?: string;
  author?: string;
  description?: string;
  icon?: string;
  badge?: string;
  location?: string;
  tags?: string[];
  pages?: string[] | PageOverride[];
  siteTitle?: string;
  siteIcon?: string;
}

export interface PageOverride {
  path: string;
  title?: string;
  icon?: string;
}

export class ContentGenerator {
  /**
   * Generate a new blog post markdown file.
   *
   * @param title - The title of the blog post
   * @param content - The main content in markdown format
   * @param date - Publication date (defaults to today)
   * @param tags - Array of tags for categorization
   * @param options - Additional frontmatter fields (author, description, icon, badge, location, pages, siteTitle, siteIcon)
   * @returns Generated markdown content
   */
  public static generatePost(
    title: string,
    content: string,
    date?: string,
    tags: string[] = [],
    options: Omit<FrontmatterOptions, "title" | "date" | "tags"> = {},
  ): string {
    const effectiveDate = this.parseDate(date,);
    const frontmatter = ContentGenerator.generateFrontmatter({
      title,
      date: effectiveDate,
      tags,
      ...options,
    },);
    return `${frontmatter}\n\n${content}`;
  }

  /**
   * Generate frontmatter for a blog post.
   *
   * @param options - All frontmatter fields
   * @returns YAML frontmatter block
   */
  public static generateFrontmatter(
    options: FrontmatterOptions,
  ): string {
    const lines: string[] = [];
    const push = (key: string, value: unknown,): void => {
      if (value === undefined || value === null) return;
      if (typeof value === "string") {
        lines.push(`${key}: "${value}"`,);
      } else if (Array.isArray(value,)) {
        if (value.length === 0) return;
        const items = value.map((v,) => {
          if (typeof v === "object" && v !== null && "path" in v) {
            const obj = v as { path: string; title?: string; icon?: string };
            const sub: string[] = [`path: "${obj.path}"`,];
            if (obj.title) sub.push(`title: "${obj.title}"`,);
            if (obj.icon) sub.push(`icon: "${obj.icon}"`,);
            return `  - ${sub.join("\n    ",)}`;
          }
          return `  - "${v}"`;
        },);
        lines.push(`${key}:\n${items.join("\n",)}`,);
      } else {
        lines.push(`${key}: "${String(value,)}"`,);
      }
    };

    push("siteTitle", options.siteTitle,);
    push("siteIcon", options.siteIcon,);
    push("title", options.title,);
    push("description", options.description,);
    push("date", options.date,);
    push("author", options.author,);
    push("icon", options.icon,);
    push("badge", options.badge,);
    push("location", options.location,);
    push("tags", options.tags,);
    push("pages", options.pages,);

    return `---\n${lines.join("\n",)}\n---\n`;
  }

  /**
   * Create a complete blog post file with proper structure.
   *
   * @param title - Title of the post
   * @param content - Main content
   * @param date - Publication date
   * @param tags - Tags array
   * @param options - Additional frontmatter fields
   * @returns Complete markdown file content
   */
  public static createPostFile(
    title: string,
    content: string,
    date?: string,
    tags: string[] = [],
    options: Omit<FrontmatterOptions, "title" | "date" | "tags"> = {},
  ): string {
    const effectiveDate = this.parseDate(date,);
    const frontmatter = ContentGenerator.generateFrontmatter({
      title,
      date: effectiveDate,
      tags,
      ...options,
    },);
    return `${frontmatter}\n\n${content}`;
  }

  /**
   * Parse and validate a date string into YYYY-MM-DD format.
   * Uses manual parsing to avoid `string | undefined` from indexed access.
   *
   * @param date - Optional date string in YYYY-MM-DD or ISO format
   * @returns Parsed date string in YYYY-MM-DD format
   */
  private static parseDate(date?: string,): string {
    if (!date) return new Date().toISOString().slice(0, 10,);
    // Accept ISO or YYYY-MM-DD
    if (date.length >= 10 && date.includes("-",)) {
      return date.slice(0, 10,);
    }
    return new Date().toISOString().slice(0, 10,);
  }
}

// Example usage
if (import.meta.main) {
  const content = ContentGenerator.createPostFile(
    "My First Blog Post",
    "# Welcome to My Blog\n\nThis is my first post content.",
    "2026-11-09",
    ["welcome", "blog",],
    {
      author: "mdBlog Team",
      description: "A comprehensive guide to mdBlog frontmatter.",
      icon: "article",
      badge: "New",
      location: "#/articles/first-post.md",
    },
  );

  const distDir = new URL("../../dist/", import.meta.url,);
  await mkpath(distDir.pathname,);
  await writeText(new URL("first-post.md", distDir,).pathname, content,);
  print("Post created in dist/",);
}
