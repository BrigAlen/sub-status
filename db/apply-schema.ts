import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("no DATABASE_URL");
  const sql = neon(url);
  const files = [
    "db/migrations/0000_init.sql",
    "db/migrations/0001_calendar.sql",
  ];
  let total = 0;
  for (const file of files) {
    let raw = "";
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      console.warn("skip missing", file);
      continue;
    }
    const statements = raw
      .split(/;\s*\n/)
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      console.log("exec:", stmt.slice(0, 70).replace(/\s+/g, " "));
      // neon HTTP driver: execute raw SQL via unsafe tagged form
      await (sql as unknown as (q: string) => Promise<unknown>)(stmt);
      total += 1;
    }
  }
  console.log("schema ok, statements=", total);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
