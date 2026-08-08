import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection
const connectionString = process.env.DATABASE_URL!;

// For server-side usage
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// For client-side usage (browser)
export const createClient = (url: string) => {
  const client = postgres(url);
  return drizzle(client, { schema });
};

// Export schema
export * from "./schema";
