/// <reference lib="deno.ns" />

/**
 * Content Generator CLI for mdBlog - Command line interface for generating blog content
 */

import {
  Command,
  exit,
  isEntrypoint,
  print,
  readText,
  writeText,
} from "./io.ts";
import { ContentGenerator, } from "./mod.ts";

/** Options accepted by the `post` command. */
interface PostOptions {
  title: string;
  content: string;
  date?: string;
  tag?: string[];
  file?: string;
}

/** Options accepted by the `batch` command. */
interface BatchOptions {
  input: string;
  outputDir?: string;
}

/** One entry of the JSON file consumed by `batch`. */
interface BatchPost {
  title: string;
  content: string;
  date?: string;
  tags?: string[];
  filename?: string;
}

const command = new Command()
  .name("blog-content-generator",)
  .version("0.1.0",)
  .description("Generate markdown content for mdBlog blog posts",)
  .command("post", "Generate a new blog post",)
  .option("-t, --title <title:string>", "Title of the blog post", {
    required: true,
  },)
  .option("-c, --content <content:string>", "Main content in markdown format", {
    required: true,
  },)
  .option("-d, --date <date:string>", "Publication date (YYYY-MM-DD format)",)
  .option("--tag <tag:string>", "Tag for categorization", {
    collect: true,
  },)
  .option(
    "-f, --file <file:string>",
    "Output filename (saves to current directory)",
  )
  .action(async (options: PostOptions,) => {
    const tags: string[] = options.tag ?? [];
    const post = ContentGenerator.createPostFile(
      options.title,
      options.content,
      options.date,
      tags,
    );

    print("Generated post content:",);
    print("================================\n",);
    print(post,);
    print("\n================================\n",);

    // Save to file if filename is provided
    if (options.file) {
      await writeText(options.file, post,);
      print(`Saved to ${options.file}`,);
    }
  },)
  .command("batch", "Generate multiple blog posts from a JSON file",)
  .option("-i, --input <input:string>", "Input JSON file with post data", {
    required: true,
  },)
  .option(
    "-o, --output-dir <output-dir:string>",
    "Output directory for generated files",
  )
  .action(async (options: BatchOptions,) => {
    const content = await readText(options.input,);
    const posts = JSON.parse(content,) as BatchPost[];

    print(`Generating ${posts.length} blog posts from ${options.input}`,);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const filename = post.filename || `post-${i + 1}.md`;
      const filepath = options.outputDir
        ? `${options.outputDir}/${filename}`
        : filename;

      const generated = ContentGenerator.createPostFile(
        post.title,
        post.content,
        post.date,
        post.tags,
      );

      await writeText(filepath, generated,);
      print(`Generated: ${filename}`,);
    }

    print("Batch generation complete!",);
  },)
  .command("list-templates", "List available content templates",)
  .action(() => {
    print("Available templates:",);
    print("\n1. Standard Blog Post: Basic markdown with frontmatter",);
    print("2. Article Template: With icon, tags, and description",);
    print("3. News Item: Quick news-style content",);
    print("4. Tutorial: Step-by-step tutorial format",);
    print("\nUse 'blog-content-generator post' to create posts.",);
  },);

if (isEntrypoint(import.meta.url,)) {
  await command.parse();
}
