import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readEnvValue } from "@/lib/env";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

// Prevent multiple instances in development
declare global {
  var db: Database | undefined;
}

function getDatabaseMaxConnections() {
  const value = Number.parseInt(process.env.DATABASE_MAX_CONNECTIONS ?? "5", 10);

  return Number.isInteger(value) && value > 0 ? value : 5;
}

function createDb() {
  const connectionString = readEnvValue(
    process.env.DATABASE_URL,
    "DATABASE_URL",
  );

  // Disable prefetch as it is not supported for "Transaction" pool mode.
  const client = postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: getDatabaseMaxConnections(),
    prepare: false,
  });

  return drizzle(client, { schema });
}

function getDb() {
  if (!global.db) {
    global.db = createDb();
  }

  return global.db;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
