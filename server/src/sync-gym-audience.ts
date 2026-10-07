import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

async function main() {
  const chainRows = await db
    .select({
      id: chains.id,
      audienceJson: chains.audienceJson,
    })
    .from(chains);

  let updated = 0;
  let skipped = 0;

  for (const chain of chainRows) {
    if (!chain.audienceJson) {
      skipped += 1;
      continue;
    }

    const rows = await db
      .update(gyms)
      .set({ audienceJson: chain.audienceJson })
      .where(eq(gyms.chainId, chain.id))
      .returning({ id: gyms.id });

    updated += rows.length;
    console.log(
      `chain ${chain.id}: set ${rows.length} gyms (audience=${chain.audienceJson})`,
    );
  }

  const listed = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gyms)
    .where(eq(gyms.listed, true));
  const womenOnly = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gyms)
    .where(
      and(
        eq(gyms.listed, true),
        sql`${gyms.audienceJson} = ${'["women"]'}`,
      ),
    );
  const everyone = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gyms)
    .where(
      and(eq(gyms.listed, true), sql`${gyms.audienceJson} LIKE ${'%"all"%'}`),
    );

  console.log(
    JSON.stringify(
      {
        updated,
        chainsWithoutAudience: skipped,
        listed: listed[0]?.n,
        listedWomenOnly: womenOnly[0]?.n,
        listedEveryoneTag: everyone[0]?.n,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
