const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { generateToken } = require('../utils/jwt');

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

async function runTests() {
  console.log('====================================================');
  console.log('🧪 LIVE ROOMS MODULE FUNCTIONAL VERIFICATION SUITE');
  console.log('====================================================\n');

  // Step 1: Health Check
  const health = await request('GET', '/api/health');
  console.log(`[1] Backend & DB Health: Status ${health.status} (DB Connected: ${health.body?.database?.connected})`);
  if (!health.body?.database?.connected) throw new Error('Database not connected');

  // Step 2: Generate Admin JWT Token
  console.log('\n[2] Generating Authorized Admin JWT Token...');
  const token = generateToken({ id: 1, email: 'admin@hotel.com', role: 'admin' });
  console.log('✅ Admin JWT Token generated successfully.');

  // Step 3: Test Room Listing (GET /api/rooms)
  console.log('\n[3] Testing GET /api/rooms (Room Listing)...');
  const roomsRes = await request('GET', '/api/rooms');
  console.log(`GET /api/rooms status: ${roomsRes.status}, Total rooms returned: ${roomsRes.body?.data?.length}`);
  console.log('Sample room:', roomsRes.body?.data?.[0]);
  if (!Array.isArray(roomsRes.body?.data) || roomsRes.body?.data?.length === 0) {
    throw new Error('Room listing failed or returned empty list');
  }
  console.log('✅ Room listing verified.');

  // Step 4: Test Room Types Listing (GET /api/rooms/types)
  console.log('\n[4] Testing GET /api/rooms/types...');
  const typesRes = await request('GET', '/api/rooms/types');
  console.log(`GET /api/rooms/types status: ${typesRes.status}, Types count: ${typesRes.body?.data?.length}`);
  const roomTypes = typesRes.body?.data;
  if (!Array.isArray(roomTypes) || roomTypes.length === 0) {
    throw new Error('Room types listing failed');
  }
  const targetTypeId = roomTypes[0].id;
  console.log(`Selected Room Type ID: ${targetTypeId} (${roomTypes[0].name})`);
  console.log('✅ Room types verified.');

  // Step 5: Test Adding a Room (POST /api/rooms)
  console.log('\n[5] Testing POST /api/rooms (Add Room #999)...');
  const addRes = await request('POST', '/api/rooms', {
    roomNumber: '999',
    roomTypeId: targetTypeId,
    floor: 9,
    pricePerNight: 5500,
    status: 'available',
  }, token);
  console.log(`Add Room status: ${addRes.status}`);
  const createdRoom = addRes.body?.data;
  console.log('Created room:', createdRoom);
  if (addRes.status !== 201 || !createdRoom?.id) {
    throw new Error('Failed to create room: ' + JSON.stringify(addRes.body));
  }
  console.log('✅ Room creation verified.');

  // Step 6: Test Duplicate Room Prevention
  console.log('\n[6] Testing Duplicate Room Prevention (Re-adding Room #999)...');
  const dupRes = await request('POST', '/api/rooms', {
    roomNumber: '999',
    roomTypeId: targetTypeId,
    floor: 9,
    pricePerNight: 5500,
    status: 'available',
  }, token);
  console.log(`Duplicate Add Status: ${dupRes.status} (Message: ${dupRes.body?.message})`);
  if (dupRes.status !== 409) {
    throw new Error('Expected 409 Conflict on duplicate room number');
  }
  console.log('✅ Duplicate room prevention verified (409 Conflict).');

  // Step 7: Test Editing Room (PUT /api/rooms/:id)
  console.log('\n[7] Testing PUT /api/rooms/:id (Edit Room #999)...');
  const editRes = await request('PUT', `/api/rooms/${createdRoom.id}`, {
    pricePerNight: 6200,
    floor: 9,
    status: 'maintenance',
  }, token);
  console.log(`Edit Room status: ${editRes.status}`);
  console.log('Updated room:', editRes.body?.data);
  if (editRes.status !== 200 || parseFloat(editRes.body?.data?.price_per_night) !== 6200) {
    throw new Error('Failed to update room: ' + JSON.stringify(editRes.body));
  }
  console.log('✅ Room editing verified.');

  // Step 8: Test Deletion Safeguard on Occupied Room
  console.log('\n[8] Testing Deletion Safeguard (Attempting delete on occupied room)...');
  // First set status to occupied
  await request('PUT', `/api/rooms/${createdRoom.id}`, { status: 'occupied' }, token);
  // Attempt delete
  const blockedDeleteRes = await request('DELETE', `/api/rooms/${createdRoom.id}`, null, token);
  console.log(`Blocked Delete status: ${blockedDeleteRes.status} (Message: ${blockedDeleteRes.body?.message})`);
  if (blockedDeleteRes.status !== 400) {
    throw new Error('Expected 400 Bad Request when deleting occupied room');
  }
  console.log('✅ Deletion safeguard on occupied room verified (Blocked with 400).');

  // Step 9: Revert status to available and delete test room
  console.log('\n[9] Testing Clean Deletion of Available Room...');
  await request('PUT', `/api/rooms/${createdRoom.id}`, { status: 'available' }, token);
  const cleanDeleteRes = await request('DELETE', `/api/rooms/${createdRoom.id}`, null, token);
  console.log(`Clean Delete status: ${cleanDeleteRes.status}`);
  if (cleanDeleteRes.status !== 200) {
    throw new Error('Failed to cleanly delete test room: ' + JSON.stringify(cleanDeleteRes.body));
  }
  console.log('✅ Clean deletion verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL 9 LIVE TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
