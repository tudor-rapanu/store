import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: process.env.DRIZZLE_ENV_FILE ?? ".env.local" });

const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations", // Changed from ./src/lib/db/migrations
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl!,
  },
});
