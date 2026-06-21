import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { getLegalDocFromSanity } from "./sanity";

// Points to the content/legal directory at the root of your project
const legalDirectory = path.join(process.cwd(), "content/legal");

export async function getLegalDocBySlug(slug: string) {
  const slugParts = slug.split("-");
  const locale = slugParts.pop();
  const legalSlug = slugParts.join("-");
  const sanityDoc =
    legalSlug && locale ? await getLegalDocFromSanity(legalSlug, locale) : null;

  if (sanityDoc) {
    return sanityDoc;
  }

  const fullPath = path.join(legalDirectory, `${slug}.md`);

  try {
    const fileContents = fs.readFileSync(fullPath, "utf8");

    // Use gray-matter to parse the post metadata section
    const { data, content } = matter(fileContents);

    // Use remark to convert markdown into HTML string
    const processedContent = await remark().use(html).process(content);

    const contentHtml = processedContent.toString();

    return {
      slug,
      title: data.title as string,
      updatedAt: data.updatedAt as string,
      contentHtml,
      source: "markdown" as const,
    };
  } catch {
    // Return null if the file doesn't exist (e.g., bad URL)
    return null;
  }
}
