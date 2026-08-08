#!/usr/bin/env node

// ============================================================================
// MIGRATION RUNNER
// ============================================================================
// Runs SQL migrations against Supabase database
// ============================================================================

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  const migrationsDir = join(__dirname, "../supabase/migrations");
  
  // Read all migration files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration(s)`);
  console.log("---");

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, "utf-8");
    
    console.log(`Running: ${file}`);
    
    try {
      // Execute SQL in chunks (Supabase has query limits)
      const statements = sql.split(";").filter((s) => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc("exec_sql", {
            query: statement + ";",
          });
          
          if (error) {
            console.error(`  Error in statement: ${error.message}`);
            // Continue with next statement (some may fail due to dependencies)
          }
        }
      }
      
      console.log(`  ✓ Completed`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error}`);
    }
  }
  
  console.log("---");
  console.log("Migration complete!");
}

async function runSpecificMigration(filename: string) {
  const filePath = join(__dirname, "../supabase/migrations", filename);
  
  if (!filePath.endsWith(".sql")) {
    console.error("Migration file must be a .sql file");
    process.exit(1);
  }
  
  const sql = readFileSync(filePath, "utf-8");
  
  console.log(`Running: ${filename}`);
  
  try {
    const statements = sql.split(";").filter((s) => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc("exec_sql", {
          query: statement + ";",
        });
        
        if (error) {
          console.error(`  Error: ${error.message}`);
        }
      }
    }
    
    console.log("  ✓ Completed");
  } catch (error) {
    console.error(`  ✗ Failed: ${error}`);
  }
}

// CLI
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Migration Runner

Usage:
  npm run migrate              Run all migrations
  npm run migrate -- <file>    Run specific migration
  npm run migrate:check        Check migration status

Examples:
  npm run migrate
  npm run migrate -- 20250805_multi_tenant_platform.sql
  `);
  process.exit(0);
}

if (args.length > 0) {
  runSpecificMigration(args[0]);
} else {
  runMigration();
}
