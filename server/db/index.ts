import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL OR DATABASE_URL_POOLED missing in .env");
};

const client = postgres(url, {prepare: false });
export const db = drizzle(client, { schema });