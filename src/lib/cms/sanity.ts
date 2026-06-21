import { remark } from "remark";
import html from "remark-html";

const projectId = process.env.SANITY_PROJECT_ID ?? "ap50mu06";
const dataset = process.env.SANITY_DATASET ?? "production";
const apiVersion = process.env.SANITY_API_VERSION ?? "2025-01-01";

type SanityLegalPage = {
  title: string;
  updatedAt: string;
  bodyMarkdown: string;
};

function getSanityQueryUrl(query: string, params: Record<string, string>) {
  const url = new URL(
    `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}`,
  );

  url.searchParams.set("query", query);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  });

  return url;
}

export async function getLegalDocFromSanity(slug: string, locale: string) {
  const query = `*[_type == "legalPage" && slug.current == $slug && locale == $locale][0]{
    title,
    updatedAt,
    bodyMarkdown
  }`;

  try {
    const response = await fetch(getSanityQueryUrl(query, { slug, locale }), {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { result?: SanityLegalPage };

    if (!payload.result?.bodyMarkdown) {
      return null;
    }

    const processedContent = await remark()
      .use(html)
      .process(payload.result.bodyMarkdown);

    return {
      slug: `${slug}-${locale}`,
      title: payload.result.title,
      updatedAt: payload.result.updatedAt,
      contentHtml: processedContent.toString(),
      source: "sanity" as const,
    };
  } catch {
    return null;
  }
}
