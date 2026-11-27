const http = require('http');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { generateToken } = require('../utils/jwt');
const { query } = require('../config/db');

// Helper to make HTTP requests to backend
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

async function runReservationTests() {
  console.log('====================================================');
  console.log('🧪 LIVE RESERVATIONS MODULE INTEGRATION TESTS');
  console.log('====================================================\n');

  let testGuestId = null;
  let testRoomId = null;
  let testRoomNumber = null;
  let testRoomPrice = 0;
  let testReservationId = null;

  try {
    // 1. Health & DB Check
    console.log('[1] Checking Backend & PostgreSQL Health...');
    const health = await request('GET', '/api/health');
    console.log(`Backend Health Status: ${health.status}, DB Connected: ${health.body?.database?.connected}`);
    if (!health.body?.database?.connected) throw new Error('Database is not connected');

    // 2. Generate Admin JWT
    console.log('\n[2] Generating Authorized Admin JWT Token...');
    const token = generateToken({ id: 1, email: 'admin@hotel.com', role: 'admin' });
    console.log('✅ Admin JWT Token generated successfully.');

    // 3. Create or Get Test Guest
    console.log('\n[3] Setting up Test Guest in PostgreSQL...');
    const guestRes = await request('POST', '/api/guests', {
      firstName: 'Rohit',
      lastName: 'Sharma',
      email: 'rohit.resv.test@example.com',
      phone: '+91 9123456789',
      idType: 'Passport',
      idNumber: 'P9876543',
      address: 'Bandra West, Mumbai',
      nationality: 'Indian',
    }, token);

    if (guestRes.status === 201) {
      testGuestId = guestRes.body?.data?.id;
    } else {
      // Find existing guest
      const existing = await query("SELECT id FROM guests WHERE email = 'rohit.resv.test@example.com' LIMIT 1");
      if (existing.rows.length > 0) {
        testGuestId = existing.rows[0].id;
      } else {
        const anyGuest = await query("SELECT id FROM guests LIMIT 1");
        testGuestId = anyGuest.rows[0].id;
      }
    }
    console.log(`✅ Using Test Guest ID: ${testGuestId}`);

    // 4. Select an available room
    console.log('\n[4] Querying available rooms in PostgreSQL...');
    const roomsInDb = await query("SELECT id, room_number, price_per_night, status FROM rooms WHERE status = 'available' LIMIT 1");
    if (roomsInDb.rows.length === 0) {
      throw new Error('No available rooms found for testing. Please ensure at least one room is available.');
    }
    testRoomId = roomsInDb.rows[0].id;
    testRoomNumber = roomsInDb.rows[0].room_number;
    testRoomPrice = parseFloat(roomsInDb.rows[0].price_per_night);
    console.log(`✅ Selected Test Room: ID ${testRoomId}, Room #${testRoomNumber}, Price ₹${testRoomPrice}/night`);

    // 5. Test Live Available Rooms Endpoint (GET /api/reservations/available-rooms)
    console.log('\n[5] Testing GET /api/reservations/available-rooms...');
    const checkIn = '2027-01-10';
    const checkOut = '2027-01-13'; // 3 nights
    const availRes = await request('GET', `/api/reservations/available-rooms?checkInDate=${checkIn}&checkOutDate=${checkOut}`, null, token);
    console.log(`GET /available-rooms status: ${availRes.status}, Available Count: ${availRes.body?.data?.length}`);
    if (availRes.status !== 200 || !Array.isArray(availRes.body?.data)) {
      throw new Error('Failed to retrieve available rooms: ' + JSON.stringify(availRes.body));
    }
    const isOurRoomInList = availRes.body.data.some((r) => r.id === testRoomId);
    if (!isOurRoomInList) {
      throw new Error(`Expected room ID ${testRoomId} to be available for ${checkIn} to ${checkOut}`);
    }
    console.log(`✅ Room #${testRoomNumber} correctly reported as available.`);

    // 6. Test Invalid Dates Validation (Check-out <= Check-in)
    console.log('\n[6] Testing Validation: Check-out before Check-in (should return 400)...');
    const invalidDateRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: '2027-01-15',
      checkOutDate: '2027-01-10',
      totalAmount: 1000,
    }, token);
    console.log(`Status with checkOut < checkIn: ${invalidDateRes.status} (Expected: 400)`);
    if (invalidDateRes.status !== 400) {
      throw new Error(`Expected 400 for invalid dates, got ${invalidDateRes.status}`);
    }
    console.log('✅ Date range validation strictly enforced.');

    // 7. Test Create Reservation with Advance Payment
    console.log('\n[7] Testing POST /api/reservations (Creating 3-night booking with ₹1000 advance)...');
    const expectedNights = 3;
    const expectedTotal = testRoomPrice * expectedNights;
    const advancePaid = 1000;

    const createRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalAmount: expectedTotal,
      advanceAmount: advancePaid,
      paymentMethod: 'upi',
      notes: 'VIP guest automated integration test booking',
    }, token);

    console.log(`POST /api/reservations status: ${createRes.status}`);
    if (createRes.status !== 201 || !createRes.body?.data?.id) {
      throw new Error('Failed to create reservation: ' + JSON.stringify(createRes.body));
    }
    testReservationId = createRes.body.data.id;
    console.log(`✅ Reservation created successfully with ID: ${testReservationId}`);

    // 8. CRITICAL RULE #7 TEST: Verify Room Status is NOT marked occupied!
    console.log('\n[8] VERIFYING RULE #7: Checking Room Status in PostgreSQL...');
    const roomStatusCheck = await query('SELECT status FROM rooms WHERE id = $1', [testRoomId]);
    const currentRoomStatus = roomStatusCheck.rows[0].status;
    console.log(`Current Room #${testRoomNumber} status in DB: '${currentRoomStatus}'`);
    if (currentRoomStatus === 'occupied') {
      throw new Error('VIOLATION OF RULE #7: Room was marked as occupied upon reservation creation!');
    }
    if (currentRoomStatus !== 'available') {
      throw new Error(`Expected room status to remain 'available', but found '${currentRoomStatus}'`);
    }
    console.log('✅ Rule #7 PASSED: Room remains "available" after future reservation creation.');

    // 9. Verify Advance Payment Recorded in payments table
    console.log('\n[9] Verifying Advance Payment in PostgreSQL `payments` table...');
    const paymentCheck = await query('SELECT * FROM payments WHERE reservation_id = $1', [testReservationId]);
    console.log(`Payment records found for reservation ${testReservationId}: ${paymentCheck.rows.length}`);
    if (paymentCheck.rows.length === 0) {
      throw new Error('Advance payment was not recorded in payments table!');
    }
    const paymentRecord = paymentCheck.rows[0];
    console.log(`Recorded Payment: Amount ₹${paymentRecord.amount}, Method: ${paymentRecord.payment_method}, Status: ${paymentRecord.payment_status}`);
    if (parseFloat(paymentRecord.amount) !== advancePaid) {
      throw new Error(`Expected payment amount ₹${advancePaid}, got ₹${paymentRecord.amount}`);
    }
    console.log('✅ Advance payment successfully persisted in payments table.');

    // 10. Conflict Safeguard Test: Attempt Overlapping Reservation for Same Room
    console.log('\n[10] Testing Conflict Safeguard: Attempting Overlapping Booking for Same Room...');
    // Overlapping date: 2027-01-11 to 2027-01-14 overlaps with 2027-01-10 to 2027-01-13
    const conflictRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: '2027-01-11',
      checkOutDate: '2027-01-14',
      totalAmount: expectedTotal,
    }, token);
    console.log(`Conflict check response status: ${conflictRes.status} (Expected: 409)`);
    if (conflictRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for overlapping reservation, got ${conflictRes.status}: ${JSON.stringify(conflictRes.body)}`);
    }
    console.log(`Conflict error message: "${conflictRes.body?.message}"`);
    console.log('✅ Overlapping booking conflict strictly detected and prevented.');

    // 11. Test GET /api/reservations (Directory & Calculations)
    console.log('\n[11] Testing GET /api/reservations (Directory with joined financial folio)...');
    const listRes = await request('GET', '/api/reservations', null, token);
    console.log(`GET /api/reservations status: ${listRes.status}, Total count: ${listRes.body?.data?.length}`);
    const foundBooking = listRes.body?.data?.find((r) => r.id === testReservationId);
    if (!foundBooking) {
      throw new Error(`Reservation ID ${testReservationId} not found in directory listing`);
    }
    console.log('Fetched Reservation Folio:', {
      id: foundBooking.id,
      guest: `${foundBooking.first_name} ${foundBooking.last_name}`,
      room: foundBooking.room_number,
      total_amount: foundBooking.total_amount,
      total_paid: foundBooking.total_paid,
      status: foundBooking.status,
    });
    if (parseFloat(foundBooking.total_paid) !== advancePaid) {
      throw new Error(`Expected total_paid to be ₹${advancePaid}, got ₹${foundBooking.total_paid}`);
    }
    console.log('✅ Directory listing and joined total_paid confirmed.');

    // 12. Test GET /api/reservations/:id
    console.log(`\n[12] Testing GET /api/reservations/${testReservationId}...`);
    const singleRes = await request('GET', `/api/reservations/${testReservationId}`, null, token);
    console.log(`GET single reservation status: ${singleRes.status}`);
    if (singleRes.status !== 200 || singleRes.body?.data?.id !== testReservationId) {
      throw new Error('Failed to retrieve single reservation');
    }
    console.log('✅ Single reservation retrieval verified.');

    // 13. Test Update Reservation (PUT /api/reservations/:id)
    console.log(`\n[13] Testing PUT /api/reservations/${testReservationId} (Extending stay to 4 nights)...`);
    const newCheckOut = '2027-01-14'; // 4 nights
    const newTotal = testRoomPrice * 4;
    const updateRes = await request('PUT', `/api/reservations/${testReservationId}`, {
      checkInDate: checkIn,
      checkOutDate: newCheckOut,
      roomId: testRoomId,
      totalAmount: newTotal,
      notes: 'Stay extended by 1 night - VIP suite service',
    }, token);
    console.log(`PUT status: ${updateRes.status}`);
    if (updateRes.status !== 200 || updateRes.body?.data?.total_amount != newTotal) {
      throw new Error('Failed to update reservation: ' + JSON.stringify(updateRes.body));
    }
    console.log(`✅ Reservation updated. New total: ₹${updateRes.body?.data?.total_amount}`);

    // 14. Test Status Transition Safeguards
    console.log('\n[14] Testing Status Update: Confirming booking...');
    const confirmRes = await request('PUT', `/api/reservations/${testReservationId}`, {
      status: 'confirmed',
    }, token);
    console.log(`Status update to confirmed: ${confirmRes.status}`);
    if (confirmRes.status !== 200 || confirmRes.body?.data?.status !== 'confirmed') {
      throw new Error('Failed to confirm reservation');
    }
    console.log('✅ Status updated to confirmed.');

    // 15. Clean up test data
    console.log(`\n[15] Cleaning up test reservation ID: ${testReservationId}...`);
    // Delete payments first
    await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
    // Delete reservation
    const delRes = await request('DELETE', `/api/reservations/${testReservationId}`, null, token);
    console.log(`DELETE status: ${delRes.status}`);
    if (delRes.status !== 200) {
      throw new Error('Failed to delete test reservation: ' + JSON.stringify(delRes.body));
    }
    // Delete test guest if created specifically for this test
    if (testGuestId) {
      await query("DELETE FROM guests WHERE email = 'rohit.resv.test@example.com'");
    }
    console.log('✅ Test data cleaned up successfully.');

    console.log('\n====================================================');
    console.log('🎉 ALL 15 RESERVATIONS MODULE TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    // Cleanup if needed
    if (testReservationId) {
      try {
        await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
        await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
      } catch (_) {}
    }
    if (testGuestId) {
      try {
        await query("DELETE FROM guests WHERE email = 'rohit.resv.test@example.com'");
      } catch (_) {}
    }
    process.exit(1);
  }
}

runReservationTests();
