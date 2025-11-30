
import { createClient } from '@supabase/supabase-js';

// Configuration from the user's context
const SUPABASE_URL = 'https://qksjuzzabwzuhmwzjcwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrc2p1enphYnd6dWhtd3pqY3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDk1NDgsImV4cCI6MjA4MDA4NTU0OH0.R4yZrGjDKvSrVQR8uhhtSn9ya6RH4WKBR0yQYsvIaMo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSettings() {
    console.log('Testing Settings Table...');

    // 1. Try to fetch existing settings
    console.log('1. Fetching settings...');
    const { data: fetchData, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'global_settings');

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
    } else {
        console.log('Fetch Success:', fetchData);
    }

    // 2. Try to upsert settings with FULL structure
    console.log('2. Upserting settings with FULL structure...');
    const fullSettings = {
        serviceRates: {
            arrivalKorean: 60,
            arrivalForeign: 40,
            departureKorean: 70,
            departureForeign: 50,
            autoGate: 120
        },
        targetWaitTime: 15,
        targetUtilization: 0.85,
        autoGateRatio: 0.3,
        foreignRatio: {
            arrival: 0.6,
            departure: 0.3
        },
        theme: "dark",
        language: "ko",
        alertThresholds: {
            blue: 7000,
            yellow: 7600,
            orange: 8200,
            red: 8600
        }
    };

    const { data: upsertData, error: upsertError } = await supabase
        .from('settings')
        .upsert({
            id: 'global_settings',
            config: fullSettings,
            updated_at: new Date().toISOString()
        })
        .select();

    if (upsertError) {
        console.error('Upsert Error:', upsertError);
    } else {
        console.log('Upsert Success:', upsertData);
    }
}

testSettings();
