import {
    pgTable,
    text,
    varchar,
    doublePrecision,
    boolean,
    integer,
    primaryKey,
} from "drizzle-orm/pg-core";

export const chains = pgTable("chains", {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    image: text("image").notNull(),
    logoFit: varchar("logo_fit", { length: 32}),
    logoClass: varchar("logo_class", { length: 64 }),
    pricingMode: varchar("pricing_mode", { length: 32 }),
    priceFrom: doublePrecision("price_from"),
    is247: boolean("is_247"),
    freeTrial: boolean("free_trial"),
    dayPass: boolean("day_pass"),
    website: text("website"),
    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    membershipsJson: text("memberships_json"),
    servicesJson: text("services_json"),
    audienceJson: text("audience_json"),
    sourceUrl: text("source_url"),
    checkedAt: varchar("checked_at", { length: 32 }),
});

export const gyms = pgTable("gyms", {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    city: varchar("city", { length: 256 }).notNull(),
    address: text("address").notNull(),
    chainId: varchar("chain_id", { length: 64 })
        .notNull()
        .references(() => chains.id),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    listed: boolean("listed").notNull().default(true),
    hiddenReason: text("hidden_reason"),
    www: text("www"),
    wwwDead: text("www_dead"),
    phone: text("phone"),
    email: text("email"),
    priceFrom: doublePrecision("price_from"),
    is247: boolean("is_247"),
    freeTrial: boolean("free_trial"),
    dayPass: boolean("day_pass"),
    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    membershipsJson: text("memberships_json"),
    servicesJson: text("services_json"),
    audienceJson: text("audience_json"),
    offerCheckedAt: varchar("offer_checked_at", { length: 32 }),
    enrichStatus: varchar("enrich_status", { length: 32 }),
    missReason: text("miss_reason"),
    offerSourceUrl: text("offer_source_url"),
    offerMethod: varchar("offer_method", { length: 32 }),
});

export const enrichRuns = pgTable("enrich_runs", {
    id: varchar("id", { length: 64 }).primaryKey(),
    startedAt: varchar("started_at", { length: 32 }).notNull(),
    finishedAt: varchar("finished_at", { length: 32 }),
    durationSec: doublePrecision("duration_sec"),
    dryRun: boolean("dry_run").notNull().default(false),
    scanned: integer("scanned").notNull().default(0),
    okCount: integer("ok_count").notNull().default(0),
    partialCount: integer("partial_count").notNull().default(0),
    unknownCount: integer("unknown_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    pricesNew: integer("prices_new").notNull().default(0),
    pricesChanged: integer("prices_changed").notNull().default(0),
    hoursNew: integer("hours_new").notNull().default(0),
    hoursChanged: integer("hours_changed").notNull().default(0),
    changesJson: text("changes_json"),
});

/**
 * The daily data check (src/verify-data.ts) writes one row per gym and fact
 * ("price" or "hours"). It says whether the value we show was found on the
 * gym's own page, and when.
 *
 *   checkedAt  = last time the robot looked
 *   verifiedAt = last time the value was really found on the page
 */
export const factChecks = pgTable(
    "fact_checks",
    {
        gymId: varchar("gym_id", { length: 64 }).notNull(),
        field: varchar("field", { length: 16 }).notNull(), // price | hours
        value: text("value"), // the value that was checked, e.g. "32.9" or "06:00–23:00"
        status: varchar("status", { length: 16 }).notNull(), // confirmed | not_found | unreachable | blocked | no_source
        sourceUrl: text("source_url"),
        checkedAt: varchar("checked_at", { length: 32 }).notNull(),
        verifiedAt: varchar("verified_at", { length: 32 }),
        note: text("note"), // e.g. other prices seen on the page
    },
    (t) => [primaryKey({ columns: [t.gymId, t.field] })],
);

/**
 * Messages from the site: "suggest a gym", "report an error" and general
 * feedback. Read them in the admin view (GET /api/admin/feedback).
 */
export const feedback = pgTable("feedback", {
    id: varchar("id", { length: 64 }).primaryKey(),
    createdAt: varchar("created_at", { length: 32 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(), // suggest | error | feedback
    gymSlug: varchar("gym_slug", { length: 128 }),
    gymName: text("gym_name"),
    place: text("place"),
    url: text("url"),
    message: text("message").notNull(),
    email: text("email"),
    lang: varchar("lang", { length: 4 }),
    status: varchar("status", { length: 16 }).notNull().default("new"), // new | done
});
