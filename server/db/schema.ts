import { pgTable, text, varchar, doublePrecision, boolean } from "drizzle-orm/pg-core";

export const chains = pgTable("chains", {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    image: text("image").notNull(),
    logoFit: varchar("logo_fit", { length: 32}),
    logoClass: varchar("logo_class", { length: 64 }),
    priceFrom: doublePrecision("price_from"),
    is247: boolean("is_247"),
    freeTrial: boolean("free_trial"),
    dayPass: boolean("day_pass"),
    website: text("website"),
    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    membershipsJson: text("memberships_json"),
    servicesJson: text("services_json"),
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
    hoursWeekday: text("hours_weekday"),
    hoursWeekend: text("hours_weekend"),
    membershipsJson: text("memberships_json"),
});
