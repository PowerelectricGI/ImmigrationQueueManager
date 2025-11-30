
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qksjuzzabwzuhmwzjcwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrc2p1enphYnd6dWhtd3pqY3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDk1NDgsImV4cCI6MjA4MDA4NTU0OH0.R4yZrGjDKvSrVQR8uhhtSn9ya6RH4WKBR0yQYsvIaMo'; // User provided token

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});
