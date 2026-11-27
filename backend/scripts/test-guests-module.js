const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { generateToken } = require('../utils/jwt');
const { query } = require('../config/db');

// Helper to make HTTP requests
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:5000');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runGuestTests() {
  console.log('====================================================');
  console.log('🧪 LIVE GUEST MANAGEMENT MODULE INTEGRATION TESTS');
  console.log('====================================================\n');

  // Step 1: Health & DB check
  const health = await request('GET', '/api/health');
  console.log(`[1] Backend & PostgreSQL Status: ${health.status} (DB Connected: ${health.body?.database?.connected})`);
  if (!health.body?.database?.connected) throw new Error('PostgreSQL not connected');

  // Step 2: Generate Admin JWT
  console.log('\n[2] Generating Authorized Admin JWT Token...');
  const token = generateToken({ id: 1, email: 'admin@hotel.com', role: 'admin' });
  console.log('✅ Admin JWT Token generated successfully.');

  // Step 3: Test Guest Listing (GET /api/guests)
  console.log('\n[3] Testing GET /api/guests (Guest Directory)...');
  const listRes = await request('GET', '/api/guests', null, token);
  console.log(`GET /api/guests status: ${listRes.status}, Count: ${listRes.body?.data?.length}`);
  if (listRes.status !== 200 || !Array.isArray(listRes.body?.data)) {
    throw new Error('Failed to retrieve guest list: ' + JSON.stringify(listRes.body));
  }
  console.log('✅ Guest listing API verified.');

  // Step 4: Test Adding New Guest (POST /api/guests)
  console.log('\n[4] Testing POST /api/guests (Register Guest: Vikram Malhotra)...');
  const newGuestPayload = {
    firstName: 'Vikram',
    lastName: 'Malhotra',
    email: 'vikram.test@example.com',
    phone: '+91 9876543210',
    idType: 'Aadhar Card',
    idNumber: '9988-7766-5544',
    address: '42 Marine Drive, Mumbai, MH',
    nationality: 'Indian',
  };
  const addRes = await request('POST', '/api/guests', newGuestPayload, token);
  console.log(`POST /api/guests status: ${addRes.status}`);
  const createdGuest = addRes.body?.data;
  console.log('Registered guest:', createdGuest);
  if (addRes.status !== 201 || !createdGuest?.id) {
    throw new Error('Failed to create guest: ' + JSON.stringify(addRes.body));
  }
  console.log('✅ Guest registration verified.');

  // Step 5: Test Search by Name
  console.log('\n[5] Testing Search by Name (GET /api/guests?search=Vikram)...');
  const searchNameRes = await request('GET', '/api/guests?search=Vikram', null, token);
  console.log(`Search status: ${searchNameRes.status}, Found: ${searchNameRes.body?.data?.length}`);
  if (searchNameRes.body?.data?.length === 0 || searchNameRes.body?.data?.[0]?.first_name !== 'Vikram') {
    throw new Error('Search by name failed to locate Vikram Malhotra');
  }
  console.log('✅ Search by name verified.');

  // Step 6: Test Search by Phone
  console.log('\n[6] Testing Search by Phone (GET /api/guests?search=9876543210)...');
  const searchPhoneRes = await request('GET', '/api/guests?search=9876543210', null, token);
  console.log(`Search phone status: ${searchPhoneRes.status}, Found: ${searchPhoneRes.body?.data?.length}`);
  if (searchPhoneRes.body?.data?.length === 0) {
    throw new Error('Search by phone failed');
  }
  console.log('✅ Search by phone verified.');

  // Step 7: Test Search by Guest ID
  console.log(`\n[7] Testing Search by Guest ID (GET /api/guests?search=${createdGuest.id})...`);
  const searchIdRes = await request('GET', `/api/guests?search=${createdGuest.id}`, null, token);
  console.log(`Search ID status: ${searchIdRes.status}, Found: ${searchIdRes.body?.data?.length}`);
  if (searchIdRes.body?.data?.length === 0) {
    throw new Error('Search by Guest ID failed');
  }
  console.log('✅ Search by Guest ID verified.');

  // Step 8: Test Filter by ID Type
  console.log('\n[8] Testing Filter by ID Type (GET /api/guests?idType=Aadhar+Card)...');
  const filterIdRes = await request('GET', '/api/guests?idType=Aadhar+Card', null, token);
  console.log(`Filter ID Type status: ${filterIdRes.status}, Count: ${filterIdRes.body?.data?.length}`);
  if (filterIdRes.status !== 200) throw new Error('Filter by ID Type failed');
  console.log('✅ Filter by ID Type verified.');

  // Step 9: Test Get Guest By ID
  console.log(`\n[9] Testing GET /api/guests/${createdGuest.id}...`);
  const getSingleRes = await request('GET', `/api/guests/${createdGuest.id}`, null, token);
  console.log(`GET single status: ${getSingleRes.status}`);
  if (getSingleRes.status !== 200 || getSingleRes.body?.data?.first_name !== 'Vikram') {
    throw new Error('Failed to retrieve single guest profile');
  }
  console.log('✅ Get guest by ID verified.');

  // Step 10: Test Get Guest Stay History (GET /api/guests/:id/history)
  console.log(`\n[10] Testing GET /api/guests/${createdGuest.id}/history...`);
  const historyRes = await request('GET', `/api/guests/${createdGuest.id}/history`, null, token);
  console.log(`History status: ${historyRes.status}, Records: ${historyRes.body?.data?.length}`);
  if (historyRes.status !== 200 || !Array.isArray(historyRes.body?.data)) {
    throw new Error('Failed to retrieve guest stay history');
  }
  console.log('✅ Guest history API verified (Returns empty array for new guest).');

  // Step 11: Test Editing Guest Profile (PUT /api/guests/:id)
  console.log(`\n[11] Testing PUT /api/guests/${createdGuest.id} (Update Address)...`);
  const editRes = await request('PUT', `/api/guests/${createdGuest.id}`, {
    address: '88 Juhu Tara Road, Mumbai, MH',
    phone: '+91 9999888877',
  }, token);
  console.log(`Update status: ${editRes.status}`);
  console.log('Updated profile:', editRes.body?.data);
  if (editRes.status !== 200 || editRes.body?.data?.address !== '88 Juhu Tara Road, Mumbai, MH') {
    throw new Error('Failed to update guest profile');
  }
  console.log('✅ Guest profile update verified.');

  // Step 12: Test Deletion Safeguard (Active reservation check)
  console.log('\n[12] Testing Deletion Safeguard against active reservations...');
  // Create a temporary active reservation for this guest
  const tempRes = await query(
    `INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, status, total_amount)
     VALUES ($1, 1, CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 'confirmed', 2400.00)
     RETURNING id`,
    [createdGuest.id]
  );
  const tempReservationId = tempRes.rows[0].id;
  console.log(`Temporary active reservation created with ID: ${tempReservationId}`);

  // Now attempt to delete the guest - must be blocked by safeguard!
  const blockedDeleteRes = await request('DELETE', `/api/guests/${createdGuest.id}`, null, token);
  console.log(`Blocked Delete status: ${blockedDeleteRes.status} (Message: ${blockedDeleteRes.body?.message})`);
  if (blockedDeleteRes.status !== 400) {
    throw new Error('Expected 400 Bad Request when deleting guest with active reservation');
  }
  console.log('✅ Deletion safeguard verified (Blocked with 400 Bad Request).');

  // Clean up temporary reservation
  await query('DELETE FROM reservations WHERE id = $1', [tempReservationId]);
  console.log('Temporary reservation cleaned up.');

  // Step 13: Test Clean Deletion of Guest
  console.log(`\n[13] Testing Clean Deletion of Guest #${createdGuest.id}...`);
  const cleanDeleteRes = await request('DELETE', `/api/guests/${createdGuest.id}`, null, token);
  console.log(`Clean delete status: ${cleanDeleteRes.status}`);
  if (cleanDeleteRes.status !== 200) {
    throw new Error('Failed to cleanly delete guest: ' + JSON.stringify(cleanDeleteRes.body));
  }
  console.log('✅ Clean guest deletion verified.');

  // Step 14: Verify Guest Record is gone from database
  console.log('\n[14] Verifying guest record is removed from PostgreSQL...');
  const verifyRes = await request('GET', `/api/guests/${createdGuest.id}`, null, token);
  console.log(`Verification status: ${verifyRes.status} (404 expected)`);
  if (verifyRes.status !== 404) {
    throw new Error('Guest was not removed from database');
  }
  console.log('✅ Database removal confirmed.');

  console.log('\n====================================================');
  console.log('🎉 ALL 14 GUEST MODULE TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('====================================================');
  process.exit(0);
}

runGuestTests().catch((err) => {
  console.error('\n❌ Guest Module Test Suite Failed:', err);
  process.exit(1);
});
