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

function getOptionalDatabaseTimeout(name: string) {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function createDb() {
  const connectionString = readEnvValue(
    process.env.DATABASE_URL,
    "DATABASE_URL",
  );

  // Disable prefetch as it is not supported for "Transaction" pool mode.
  const connection: Record<string, string | number> = {
    application_name: "todds-threads-storefront",
  };
  const idleInTransactionTimeout = getOptionalDatabaseTimeout(
    "DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS",
  );
  const lockTimeout = getOptionalDatabaseTimeout("DATABASE_LOCK_TIMEOUT_MS");
  const statementTimeout = getOptionalDatabaseTimeout(
    "DATABASE_STATEMENT_TIMEOUT_MS",
  );

  if (idleInTransactionTimeout) {
    connection.idle_in_transaction_session_timeout = idleInTransactionTimeout;
  }

  if (lockTimeout) {
    connection.lock_timeout = lockTimeout;
  }

  if (statementTimeout) {
    connection.statement_timeout = statementTimeout;
  }

  const client = postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: getDatabaseMaxConnections(),
    prepare: false,
    connection,
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
