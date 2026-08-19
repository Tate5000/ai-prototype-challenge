import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!cached) {
    const sql = neon(process.env.DATABASE_URL!);
    cached = drizzle(sql, { schema });
  }
  return cached;
}
