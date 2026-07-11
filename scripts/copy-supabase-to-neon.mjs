import fs from "node:fs";
import postgres from "postgres";

const sourceEnvFile = process.env.SOURCE_ENV_FILE ?? ".env.local";
const targetEnvFile = process.env.TARGET_ENV_FILE ?? ".env.neon.local";

const tableOrder = [
  "sameday_counties",
  "sameday_cities",
  "size_guides",
  "categories",
  "products",
  "product_variants",
  "product_categories",
  "product_detail_blocks",
  "digital_product_files",
  "discounts",
  "shipping_profiles",
  "shipping_provider_tokens",
  "store_settings",
  "customer_profiles",
  "orders",
  "order_items",
  "discount_usages",
];
const insertChunkSize = 500;

function parseEnvFile(file) {
  const values = {};
  const text = fs.readFileSync(file, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed
      .slice(separatorIndex + 1)
      .replace(/^["']|["']$/g, "");

    values[key] = value;
  }

  return values;
}

function getDatabaseUrl(env, names) {
  for (const name of names) {
    if (env[name]) {
      return env[name];
    }
  }

  throw new Error(`Missing one of: ${names.join(", ")}`);
}

function quoteIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatColumnList(columns) {
  return columns.map(quoteIdent).join(", ");
}

async function getColumns(sql, tableName) {
  const rows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${tableName}
    order by ordinal_position
  `;

  return rows.map((row) => row.column_name);
}

async function copyTable(source, target, tableName) {
  const columns = await getColumns(source, tableName);

  if (columns.length === 0) {
    console.log(`${tableName}: skipped, source table not found`);
    return;
  }

  const rows = await source.unsafe(
    `select ${formatColumnList(columns)} from ${quoteIdent(tableName)}`,
  );

  if (rows.length === 0) {
    console.log(`${tableName}: 0 rows`);
    return;
  }

  const targetColumns = await getColumns(target, tableName);
  const sharedColumns = columns.filter((column) =>
    targetColumns.includes(column),
  );

  for (let start = 0; start < rows.length; start += insertChunkSize) {
    const chunk = rows.slice(start, start + insertChunkSize);

    await target.unsafe(
      `insert into ${quoteIdent(tableName)} (${formatColumnList(sharedColumns)}) values ${chunk
        .map(
          (_row, rowIndex) =>
            `(${sharedColumns
              .map(
                (_column, columnIndex) =>
                  `$${rowIndex * sharedColumns.length + columnIndex + 1}`,
              )
              .join(", ")})`,
        )
        .join(", ")}`,
      chunk.flatMap((row) => sharedColumns.map((column) => row[column])),
    );
  }

  console.log(`${tableName}: ${rows.length} rows`);
}

async function resetTarget(target) {
  await target.unsafe(
    `truncate ${tableOrder.map(quoteIdent).join(", ")} restart identity cascade`,
  );
}

async function resetSequences(target) {
  await target`
    select setval(
      pg_get_serial_sequence('orders', 'order_number'),
      coalesce((select max(order_number) from orders), 1),
      (select count(*) > 0 from orders)
    )
  `;
}

const sourceEnv = parseEnvFile(sourceEnvFile);
const targetEnv = parseEnvFile(targetEnvFile);
const sourceUrl = getDatabaseUrl({ ...sourceEnv, ...process.env }, [
  "SOURCE_DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_URL",
]);
const targetUrl = getDatabaseUrl({ ...targetEnv, ...process.env }, [
  "TARGET_DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL",
]);
const source = postgres(sourceUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
});
const target = postgres(targetUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
});

try {
  console.log(`Copying data from ${sourceEnvFile} to ${targetEnvFile}`);
  await resetTarget(target);

  for (const tableName of tableOrder) {
    await copyTable(source, target, tableName);
  }

  await resetSequences(target);
  console.log("Done.");
} finally {
  await source.end();
  await target.end();
}
