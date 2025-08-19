import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use Supabase database URL if available, otherwise fall back to local DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log('🔧 Connecting to Supabase database...');

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
export const db = drizzle({ client: pool, schema });