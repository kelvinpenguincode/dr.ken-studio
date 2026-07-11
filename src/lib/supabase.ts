import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for optional auth/storage integrations.
 * The core app uses Prisma + PostgreSQL; this client is ready for future features.
 */
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

/**
 * Placeholder for future Google Sheets export integration.
 * Wire credentials from env vars when ready.
 */
export const googleSheetsConfig = {
  clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL ?? "",
  privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "",
  spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "",
  isConfigured() {
    return Boolean(this.clientEmail && this.privateKey && this.spreadsheetId);
  },
};
