// js/config.js — Peak Dates configuration
//
// Peak Dates runs in LOCAL mode by default: all data lives in your browser's
// localStorage, so the app works instantly on GitHub Pages with zero setup.
//
// To switch to a real Supabase backend later:
//   1. Create a Supabase project (free tier).
//   2. Run the schema in /supabase/schema.sql.
//   3. Fill in the values below and set BACKEND = 'supabase'.
//   4. Implement the SupabaseStore adapter in js/store.js (interface is documented there).
//
// The Supabase URL + anon key are public-safe — Row Level Security enforces access.

export const CONFIG = {
  // 'local'  → localStorage (default, no account server needed)
  // 'supabase' → Supabase Auth + Postgres (requires setup below)
  BACKEND: 'local',

  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',

  // Default map center — Denver, CO
  MAP_CENTER: [39.7392, -104.9903],
  MAP_ZOOM: 9,

  APP_NAME: 'Peak Dates',
  TAGLINE: 'Every date, a new summit',
};
