import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../exports");

async function main() {
  const rows = await db.select().from(gyms);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `backup-gyms-before-salit-json-${stamp}.json`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: {
          kind: "liikux-gyms-backup",
          createdAt: new Date().toISOString(),
          count: rows.length,
          restore: "cd server && npx tsx src/restore-gyms-backup.ts --file=../exports/<tämä-tiedosto>",
        },
        gyms: rows,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Backup OK: ${outPath}`);
  console.log(`gyms=${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
