import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Replace with your Supabase project URL.
const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";

// Replace with your Supabase anon public key.
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
