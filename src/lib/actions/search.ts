"use server";

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { publicProductWhere } from "@/lib/catalog/cache";
import { and, sql } from "drizzle-orm";

export async function searchCatalog(searchTerm: string, locale: "en" | "ro") {
  if (!searchTerm || searchTerm.trim() === "") return [];

  // Postgres has built-in language dictionaries for stemming (e.g., matching "running" to "run")
  const dict = locale === "en" ? "english" : "romanian";
  const trimmedTerm = searchTerm.trim();

  const results = await db
    .select()
    .from(products)
    .where(
      and(
        publicProductWhere(),
        sql`(
          (
            to_tsvector(${sql.raw(`'${dict}'`)}, ${products.title}->>${locale}) ||
            to_tsvector(${sql.raw(`'${dict}'`)}, coalesce(${products.description}->>${locale}, ''))
          ) @@ websearch_to_tsquery(${sql.raw(`'${dict}'`)}, ${trimmedTerm})
          or ${products.title}->>${locale} ilike ${`%${trimmedTerm}%`}
        )`,
      ),
    )
    .orderBy(
      sql`ts_rank_cd(
        to_tsvector(${sql.raw(`'${dict}'`)}, ${products.title}->>${locale}) ||
        to_tsvector(${sql.raw(`'${dict}'`)}, coalesce(${products.description}->>${locale}, '')),
        websearch_to_tsquery(${sql.raw(`'${dict}'`)}, ${trimmedTerm})
      ) desc`,
    )
    // Optional: Limit results so a broad search doesn't crash the frontend
    .limit(20);

  return results;
}
