import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

const args = process.argv.slice(2);
const fileArg = (args.find((a) => a.startsWith("--file=")) ?? "").split("=")[1];
if (!fileArg) {
  console.error("Käytä: npx tsx src/restore-gyms-backup.ts --file=../exports/backup-gyms-....json");
  process.exit(1);
}

async function main() {
  const path = resolve(fileArg!);
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    meta?: { count?: number };
    gyms: (typeof gyms.$inferSelect)[];
  };
  if (!Array.isArray(raw.gyms) || !raw.gyms.length) {
    console.error("Backupissa ei ole gyms-taulukkoa.");
    process.exit(1);
  }

  let updated = 0;
  for (const g of raw.gyms) {
    const { id, ...rest } = g;
    await db.update(gyms).set(rest).where(eq(gyms.id, id));
    updated++;
    if (updated % 200 === 0) console.log(`restored ${updated}/${raw.gyms.length}`);
  }
  console.log(`Restore OK from ${path}`);
  console.log(`updated=${updated}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
