import type { MetadataRoute } from "next";
import { asc } from "drizzle-orm";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getCachedPublicCategories, publicProductWhere } from "@/lib/catalog/cache";

const SITE_URL = "https://toddsthreads.com";
const LOCALES = ["en", "ro"] as const;

// Without this, Next.js tries to prerender /sitemap.xml at `npm run build`
// time, which runs inside the Docker build stage where DATABASE_URL isn't
// available (it's only injected at Cloud Run runtime).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [allProducts, categories] = await Promise.all([
    db
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(publicProductWhere())
      .orderBy(asc(products.slug)),
    getCachedPublicCategories(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push(
      { url: `${SITE_URL}/${locale}`, changeFrequency: "daily", priority: 1 },
      { url: `${SITE_URL}/${locale}/products`, changeFrequency: "daily", priority: 0.9 },
    );

    for (const category of categories) {
      entries.push({
        url: `${SITE_URL}/${locale}/category/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }

    for (const product of allProducts) {
      entries.push({
        url: `${SITE_URL}/${locale}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
