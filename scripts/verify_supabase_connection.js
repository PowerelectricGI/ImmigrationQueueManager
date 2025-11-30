
const https = require('https');

const SUPABASE_URL = 'https://qksjuzzabwzuhmwzjcwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrc2p1enphYnd6dWhtd3pqY3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDk1NDgsImV4cCI6MjA4MDA4NTU0OH0.R4yZrGjDKvSrVQR8uhhtSn9ya6RH4WKBR0yQYsvIaMo';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL.replace('https://', '').replace('/', ''),
            path: `/rest/v1/${path}`,
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation' // Return the inserted/updated data
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data); // Empty response or non-json
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTest() {
    console.log('Starting Supabase Verification...');

    // 1. Test Connection & Read (GET)
    try {
        console.log('1. Testing Read (GET /staff)...');
        const staff = await request('GET', 'staff?select=*&limit=1');
        console.log('   Success! Staff table exists. Count:', staff.length);
    } catch (error) {
        console.error('   Failed to read staff table. Did you create the table?');
        console.error('   Error:', error.message);
        return;
    }

    // 2. Test Write (POST)
    const testId = 'test_user_' + Date.now();
    try {
        console.log('2. Testing Write (POST /staff)...');
        const newStaff = {
            id: testId,
            name: 'Test Bot',
            status: 'idle',
            assignment: null
        };
        const result = await request('POST', 'staff', newStaff);
        console.log('   Success! Inserted test user:', result[0].name);
    } catch (error) {
        console.error('   Failed to write to staff table.');
        console.error('   Error:', error.message);
        return;
    }

    // 3. Clean up (DELETE)
    try {
        console.log('3. Cleaning up (DELETE)...');
        // DELETE /staff?id=eq.testId
        await request('DELETE', `staff?id=eq.${testId}`);
        console.log('   Success! Test user deleted.');
    } catch (error) {
        console.warn('   Failed to delete test user. You might need to delete it manually.');
        console.warn('   Error:', error.message);
    }

    console.log('\nVerification Complete: Supabase connection is working!');
}

runTest();
