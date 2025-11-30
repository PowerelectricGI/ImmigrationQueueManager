
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qksjuzzabwzuhmwzjcwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrc2p1enphYnd6dWhtd3pqY3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDk1NDgsImV4cCI6MjA4MDA4NTU0OH0.R4yZrGjDKvSrVQR8uhhtSn9ya6RH4WKBR0yQYsvIaMo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRealtime() {
    console.log('Starting Realtime Verification...');

    const channel = supabase.channel('test-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'staff' },
            (payload) => {
                console.log('✅ EVENT RECEIVED:', payload.eventType);
                process.exit(0); // Success!
            }
        )
        .subscribe((status) => {
            console.log('Subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('Subscribed! Waiting for events...');
                triggerChange();
            }
        });

    // Wait 10 seconds for event
    setTimeout(() => {
        console.error('❌ TIMEOUT: No event received in 10 seconds.');
        console.error('POSSIBLE CAUSE: Realtime is not enabled for the "staff" table.');
        process.exit(1);
    }, 10000);
}

async function triggerChange() {
    console.log('Triggering a change (INSERT)...');
    const { error } = await supabase.from('staff').insert({
        id: 'realtime_test_' + Date.now(),
        name: 'Realtime Tester',
        status: 'idle'
    });

    if (error) console.error('Insert failed:', error);
}

testRealtime();
