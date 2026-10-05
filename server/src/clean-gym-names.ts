import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

function cleanGymName(name: string) {
  return name
    .replace(/\s*\/\s*kuntokeskus\b/gi, "")
    .replace(/\s*\/\s*kuntosalit?\b.*$/gi, "")
    .replace(/\s*-\s*kuntokeskus\b/gi, "")
    .replace(/\s*-\s*kuntosali\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function main() {
  const rows = await db.select({ id: gyms.id, name: gyms.name }).from(gyms);
  let n = 0;
  for (const row of rows) {
    const next = cleanGymName(row.name);
    if (next === row.name || !next) continue;
    await db.update(gyms).set({ name: next }).where(eq(gyms.id, row.id));
    n++;
    console.log(`${row.name} -> ${next}`);
  }
  console.log(`Cleaned ${n} gym names`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
