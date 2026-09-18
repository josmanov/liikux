import { pgTable, text, varchar, doublePrecision } from "drizzle-orm/pg-core";

export const chains = pgTable("chains", {
    id: varchar("id", { length: 64 }).primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    image: text("image").notNull(),
    logoFit: varchar("logo_fit", { length: 32}),
    logoClass: varchar("logo_class", { length: 64 }),
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
});