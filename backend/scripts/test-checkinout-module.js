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

async function runCheckInOutTests() {
  console.log('====================================================');
  console.log('🧪 LIVE CHECK-IN / CHECK-OUT MODULE INTEGRATION TESTS');
  console.log('====================================================\n');

  let testGuestId = null;
  let testRoomId = null;
  let testRoomNumber = null;
  let testReservationId = null;
  let testStayId = null;

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

    // 3. Create Test Guest
    console.log('\n[3] Setting up Test Guest in PostgreSQL...');
    const guestRes = await request('POST', '/api/guests', {
      firstName: 'Arjun',
      lastName: 'Kapoor',
      email: 'arjun.checkin.test@example.com',
      phone: '+91 9988776655',
      idType: 'Driving License',
      idNumber: 'DL-04-2022-0099',
      address: '77 Connaught Place, New Delhi',
      nationality: 'Indian',
    }, token);

    if (guestRes.status === 201) {
      testGuestId = guestRes.body?.data?.id;
    } else {
      const existing = await query("SELECT id FROM guests WHERE email = 'arjun.checkin.test@example.com' LIMIT 1");
      testGuestId = existing.rows[0].id;
    }
    console.log(`✅ Using Test Guest ID: ${testGuestId}`);

    // 4. Select an available room
    console.log('\n[4] Querying available room in PostgreSQL...');
    const roomRes = await query("SELECT id, room_number, price_per_night, status FROM rooms WHERE status = 'available' LIMIT 1");
    if (roomRes.rows.length === 0) {
      throw new Error('No available rooms found for testing.');
    }
    testRoomId = roomRes.rows[0].id;
    testRoomNumber = roomRes.rows[0].room_number;
    console.log(`✅ Selected Test Room: ID ${testRoomId}, Room #${testRoomNumber}`);

    // 5. Create Test Reservation
    console.log('\n[5] Creating Test Reservation for Check-in...');
    const createRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: '2027-02-01',
      checkOutDate: '2027-02-03',
      totalAmount: 2400,
      advanceAmount: 1000,
      paymentMethod: 'upi',
      notes: 'Check-in test booking',
    }, token);

    if (createRes.status !== 201 || !createRes.body?.data?.id) {
      throw new Error('Failed to create reservation: ' + JSON.stringify(createRes.body));
    }
    testReservationId = createRes.body.data.id;
    console.log(`✅ Test Reservation created successfully with ID: ${testReservationId}`);

    // 6. Verify Rule #5: Room MUST NOT be marked occupied before physical check-in
    console.log('\n[6] VERIFYING RULE #5: Room status prior to physical check-in...');
    const preCheckRoom = await query('SELECT status FROM rooms WHERE id = $1', [testRoomId]);
    console.log(`Room #${testRoomNumber} status: '${preCheckRoom.rows[0].status}'`);
    if (preCheckRoom.rows[0].status !== 'available') {
      throw new Error(`Expected room to remain 'available', but found '${preCheckRoom.rows[0].status}'`);
    }
    console.log('✅ Rule #5 PASSED: Room is not marked occupied before check-in.');

    // 7. Test Summary Metrics Endpoint
    console.log('\n[7] Testing GET /api/check-in-out/summary...');
    const summaryRes = await request('GET', '/api/check-in-out/summary', null, token);
    console.log(`Summary Status: ${summaryRes.status}, Data:`, summaryRes.body?.data);
    if (summaryRes.status !== 200 || typeof summaryRes.body?.data?.activeStays !== 'number') {
      throw new Error('Failed to retrieve summary metrics: ' + JSON.stringify(summaryRes.body));
    }
    console.log('✅ Summary metrics API verified.');

    // 8. Test Eligible Reservations Endpoint
    console.log('\n[8] Testing GET /api/check-in-out/eligible (Pending Arrivals)...');
    const eligibleRes = await request('GET', '/api/check-in-out/eligible', null, token);
    console.log(`Eligible Status: ${eligibleRes.status}, Count: ${eligibleRes.body?.data?.length}`);
    const foundEligible = eligibleRes.body?.data?.find((r) => r.id === testReservationId);
    if (!foundEligible) {
      throw new Error(`Expected reservation #${testReservationId} in eligible arrivals list.`);
    }
    console.log(`✅ Reservation #${testReservationId} found in eligible arrivals.`);

    // 9. Negative Test: Checkout without Check-in Rejection
    console.log('\n[9] Negative Test: Attempting Checkout before Check-in (should return 400)...');
    const earlyCheckoutRes = await request('POST', '/api/check-in-out/check-out', {
      reservationId: testReservationId,
    }, token);
    console.log(`Checkout without checkin status: ${earlyCheckoutRes.status} (Expected: 400)`);
    if (earlyCheckoutRes.status !== 400) {
      throw new Error(`Expected 400 for early checkout, got ${earlyCheckoutRes.status}`);
    }
    console.log('✅ Premature checkout strictly rejected.');

    // 10. Perform Check-in (Transaction Test)
    console.log('\n[10] Testing POST /api/check-in-out/check-in (Physical Arrival & Key Card Issuance)...');
    const checkInRes = await request('POST', '/api/check-in-out/check-in', {
      reservationId: testReservationId,
      roomKeyStatus: 'issued',
      notes: 'Keycard RFID-101 issued. VIP Welcome beverage served.',
    }, token);

    console.log(`POST /check-in status: ${checkInRes.status}`);
    if (checkInRes.status !== 201 || !checkInRes.body?.data?.id) {
      throw new Error('Failed to perform check-in: ' + JSON.stringify(checkInRes.body));
    }
    testStayId = checkInRes.body.data.id;
    console.log(`✅ Check-in recorded with Stay ID: ${testStayId}`);

    // 11. Verify Room Status Changed to OCCUPIED
    console.log('\n[11] Verifying Room Status updated to OCCUPIED in PostgreSQL...');
    const postCheckRoom = await query('SELECT status FROM rooms WHERE id = $1', [testRoomId]);
    console.log(`Current Room #${testRoomNumber} status: '${postCheckRoom.rows[0].status}'`);
    if (postCheckRoom.rows[0].status !== 'occupied') {
      throw new Error(`Expected room status to be 'occupied', got '${postCheckRoom.rows[0].status}'`);
    }
    console.log('✅ Room status successfully transitioned to OCCUPIED.');

    // 12. Negative Test: Double Check-in Prevention
    console.log('\n[12] Negative Test: Attempting Duplicate Check-in for Same Reservation (should return 409)...');
    const dupCheckInRes = await request('POST', '/api/check-in-out/check-in', {
      reservationId: testReservationId,
    }, token);
    console.log(`Duplicate check-in status: ${dupCheckInRes.status} (Expected: 409)`);
    if (dupCheckInRes.status !== 409) {
      throw new Error(`Expected 409 for duplicate check-in, got ${dupCheckInRes.status}`);
    }
    console.log(`Duplicate rejection message: "${dupCheckInRes.body?.message}"`);
    console.log('✅ Double check-in strictly prevented.');

    // 13. Test Active In-House Stays Listing
    console.log('\n[13] Testing GET /api/check-in-out/active (In-House Stays)...');
    const activeRes = await request('GET', '/api/check-in-out/active', null, token);
    console.log(`Active Stays Status: ${activeRes.status}, Count: ${activeRes.body?.data?.length}`);
    const foundStay = activeRes.body?.data?.find((s) => s.id === testStayId);
    if (!foundStay) {
      throw new Error(`Stay ID ${testStayId} not found in active stays list.`);
    }
    console.log(`✅ Stay #${testStayId} verified in active in-house stays:`, {
      guest: `${foundStay.first_name} ${foundStay.last_name}`,
      room: foundStay.room_number,
      key_status: foundStay.room_key_status,
      room_status: foundStay.room_status,
    });

    // 14. Perform Check-out with Folio Settlement
    console.log('\n[14] Testing POST /api/check-in-out/check-out (Departure & Folio Settlement)...');
    // Balance was 2400 - 1000 = 1400. Settle full 1400 via UPI
    const settleAmt = 1400;
    const checkOutRes = await request('POST', '/api/check-in-out/check-out', {
      checkInOutId: testStayId,
      reservationId: testReservationId,
      roomKeyStatus: 'returned',
      settlePayment: settleAmt,
      paymentMethod: 'upi',
      notes: 'Minibar cleared. Keycard returned in good order.',
    }, token);

    console.log(`POST /check-out status: ${checkOutRes.status}`);
    if (checkOutRes.status !== 200 || !checkOutRes.body?.data?.actual_check_out) {
      throw new Error('Failed to perform checkout: ' + JSON.stringify(checkOutRes.body));
    }
    console.log('✅ Checkout completed successfully.');

    // 15. Verify Settlement Payment persisted in payments table
    console.log('\n[15] Verifying Settlement Payment in PostgreSQL `payments` table...');
    const settlePaymentCheck = await query(
      "SELECT * FROM payments WHERE reservation_id = $1 AND amount = $2",
      [testReservationId, settleAmt]
    );
    if (settlePaymentCheck.rows.length === 0) {
      throw new Error('Checkout settlement payment was not recorded in payments table.');
    }
    console.log(`✅ Settlement payment of ₹${settleAmt} confirmed in payments table.`);

    // 16. Verify Reservation Status updated to 'completed'
    console.log('\n[16] Verifying Reservation Status updated to COMPLETED in PostgreSQL...');
    const resCheck = await query('SELECT status FROM reservations WHERE id = $1', [testReservationId]);
    console.log(`Reservation #${testReservationId} status: '${resCheck.rows[0].status}'`);
    if (resCheck.rows[0].status !== 'completed') {
      throw new Error(`Expected reservation status 'completed', got '${resCheck.rows[0].status}'`);
    }
    console.log('✅ Reservation marked COMPLETED.');

    // 17. Verify Safe Room Availability Release
    console.log('\n[17] Verifying Safe Room Availability Release in PostgreSQL...');
    const postCheckoutRoom = await query('SELECT status FROM rooms WHERE id = $1', [testRoomId]);
    console.log(`Room #${testRoomNumber} status after departure: '${postCheckoutRoom.rows[0].status}'`);
    if (postCheckoutRoom.rows[0].status !== 'available') {
      throw new Error(`Expected room to be released to 'available', got '${postCheckoutRoom.rows[0].status}'`);
    }
    console.log('✅ Room successfully returned to AVAILABLE.');

    // 18. Verify Stay History
    console.log('\n[18] Testing GET /api/check-in-out/history (Stay Archive)...');
    const historyRes = await request('GET', '/api/check-in-out/history?status=completed', null, token);
    console.log(`History status: ${historyRes.status}, Completed count: ${historyRes.body?.data?.length}`);
    const foundHistory = historyRes.body?.data?.find((h) => h.id === testStayId);
    if (!foundHistory) {
      throw new Error(`Stay ID ${testStayId} not found in completed history.`);
    }
    console.log('✅ Stay verified in departure history archive.');

    // 19. Clean up test data
    console.log('\n[19] Cleaning up test records from PostgreSQL...');
    await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
    await query('DELETE FROM check_in_out WHERE id = $1', [testStayId]);
    await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
    if (testGuestId) {
      await query("DELETE FROM guests WHERE email = 'arjun.checkin.test@example.com'");
    }
    console.log('✅ Test data safely removed.');

    console.log('\n====================================================');
    console.log('🎉 ALL 19 CHECK-IN / CHECK-OUT TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    if (testStayId) {
      try { await query('DELETE FROM check_in_out WHERE id = $1', [testStayId]); } catch (_) {}
    }
    if (testReservationId) {
      try {
        await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
        await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
      } catch (_) {}
    }
    if (testGuestId) {
      try { await query("DELETE FROM guests WHERE email = 'arjun.checkin.test@example.com'"); } catch (_) {}
    }
    process.exit(1);
  }
}

runCheckInOutTests();
