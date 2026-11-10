/// <reference lib="deno.ns" />

import { describe, it, } from "@std/testing/bdd";
import { assert, } from "@std/assert";
import { ContentGenerator, } from "@vanaware/blog";

describe("ContentGenerator", () => {
  describe("generatePost", () => {
    it("should generate markdown with frontmatter", () => {
      const result = ContentGenerator.generatePost(
        "Test Post",
        "Hello World",
        "2026-11-09",
        ["test",],
      );

      assert(result.includes('title: "Test Post"',),);
      assert(result.includes('date: "2026-11-09"',),);
      assert(result.includes("tags:",),);
      assert(result.includes('  - "test"',),);
    });

    it("should generate markdown without tags", () => {
      const result = ContentGenerator.generatePost(
        "Untitled",
        "Just content",
      );

      assert(result.includes('title: "Untitled"',),);
      assert(result.includes("date:",),);
      assert(!result.includes("tags:",),);
    });

    it("should support all frontmatter fields", () => {
      const result = ContentGenerator.generatePost(
        "Comprehensive Post",
        "Content",
        "2026-11-09",
        ["tag1", "tag2",],
        {
          author: "mdBlog Team",
          description: "A comprehensive guide to mdBlog frontmatter.",
          icon: "article",
          badge: "New",
          location: "#/articles/comprehensive-post.md",
          pages: ["child-a.md", "child-b.md",],
        },
      );

      assert(result.includes('title: "Comprehensive Post"',),);
      assert(result.includes('date: "2026-11-09"',),);
      assert(result.includes('author: "mdBlog Team"',),);
      assert(
        result.includes(
          'description: "A comprehensive guide to mdBlog frontmatter."',
        ),
      );
      assert(result.includes('icon: "article"',),);
      assert(result.includes('badge: "New"',),);
      assert(result.includes('location: "#/articles/comprehensive-post.md"',),);
      assert(result.includes("tags:",),);
      assert(result.includes('  - "tag1"',),);
      assert(result.includes('  - "tag2"',),);
      assert(result.includes("pages:",),);
      assert(result.includes('  - "child-a.md"',),);
      assert(result.includes('  - "child-b.md"',),);
    });

    it("should support index.md-only fields", () => {
      const result = ContentGenerator.generatePost(
        "Index Page",
        "Content",
        "2026-11-09",
        [],
        {
          siteTitle: "My Documentation",
          siteIcon: "menu_book",
        },
      );

      assert(result.includes('siteTitle: "My Documentation"',),);
      assert(result.includes('siteIcon: "menu_book"',),);
    });

    it("should support override pages format", () => {
      const result = ContentGenerator.generatePost(
        "Parent",
        "Content",
        "2026-11-09",
        [],
        {
          pages: [
            { path: "child-a.md", title: "Child A", icon: "install_desktop", },
            { path: "child-b.md", title: "Child B", },
          ],
        },
      );

      assert(result.includes("pages:",),);
      assert(result.includes('path: "child-a.md"',),);
      assert(result.includes('title: "Child A"',),);
      assert(result.includes('icon: "install_desktop"',),);
      assert(result.includes('path: "child-b.md"',),);
      assert(result.includes('title: "Child B"',),);
    });

    it("should omit undefined fields", () => {
      const result = ContentGenerator.generatePost(
        "Minimal Post",
        "Content",
      );

      assert(result.includes('title: "Minimal Post"',),);
      assert(!result.includes("author:",),);
      assert(!result.includes("description:",),);
      assert(!result.includes("icon:",),);
      assert(!result.includes("badge:",),);
      assert(!result.includes("location:",),);
      assert(!result.includes("tags:",),);
      assert(!result.includes("pages:",),);
      assert(!result.includes("siteTitle:",),);
      assert(!result.includes("siteIcon:",),);
    });
  });

  describe("createPostFile", () => {
    it("should create complete markdown file structure", () => {
      const result = ContentGenerator.createPostFile(
        "My Blog Post",
        "# Content\n\nSome content here",
        "2026-11-09",
        ["my", "blog",],
      );

      assert(result.startsWith("---",),);
      assert(result.includes('title: "My Blog Post"',),);
      assert(result.includes('date: "2026-11-09"',),);
      assert(result.includes("tags:",),);
      assert(result.includes('  - "my"',),);
      assert(result.includes('  - "blog"',),);
      assert(result.endsWith("\n\n# Content\n\nSome content here",),);
    });

    it("should create markdown without tags when none provided", () => {
      const result = ContentGenerator.createPostFile(
        "Post Without Tags",
        "Just some content",
      );

      assert(result.startsWith("---",),);
      assert(result.includes('title: "Post Without Tags"',),);
      assert(result.includes("date:",),);
      assert(!result.includes("tags:",),);
    });
  });
});
