import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use Replit database URL first, then fall back to Supabase
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log('🔧 Connecting to PostgreSQL database...');

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
export const db = drizzle({ client: pool, schema });