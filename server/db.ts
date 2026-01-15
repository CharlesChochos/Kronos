import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!;

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
