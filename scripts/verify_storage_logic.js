
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qksjuzzabwzuhmwzjcwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrc2p1enphYnd6dWhtd3pqY3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDk1NDgsImV4cCI6MjA4MDA4NTU0OH0.R4yZrGjDKvSrVQR8uhhtSn9ya6RH4WKBR0yQYsvIaMo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function testSave() {
    console.log('Testing Storage.save logic...');

    const testData = [
        {
            id: 'test_logic_' + Date.now(),
            name: 'Logic Tester',
            status: 'idle',
            assignment: null
        }
    ];

    try {
        // 1. Upsert
        console.log('1. Attempting Upsert...');
        const updates = testData.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            assignment: s.assignment,
            updated_at: new Date().toISOString()
        }));

        const { error: upsertError } = await supabase
            .from('staff')
            .upsert(updates);

        if (upsertError) {
            console.error('Upsert Error:', upsertError);
            throw upsertError;
        }
        console.log('   Upsert Successful.');

        // 2. Delete
        console.log('2. Attempting Delete (Sync)...');
        const currentIds = testData.map(s => s.id);

        if (currentIds.length > 0) {
            // This is the suspicious line from storage.js
            // .not('id', 'in', `(${currentIds.join(',')})`);

            // Testing the exact syntax used in storage.js
            const { error: deleteError } = await supabase
                .from('staff')
                .delete()
                .not('id', 'in', `(${currentIds.join(',')})`);

            if (deleteError) {
                console.error('Delete Error:', deleteError);
                throw deleteError;
            }
        }
        console.log('   Delete Successful.');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        process.exit(1);
    }

    console.log('✅ Test Passed!');

    // Cleanup
    await supabase.from('staff').delete().eq('id', testData[0].id);
}

testSave();
