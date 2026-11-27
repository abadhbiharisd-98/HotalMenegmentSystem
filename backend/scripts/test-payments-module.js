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

async function runPaymentTests() {
  console.log('====================================================');
  console.log('🧪 LIVE PAYMENTS MODULE INTEGRATION TESTS');
  console.log('====================================================\n');

  let testGuestId = null;
  let testRoomId = null;
  let testReservationId = null;
  let createdPaymentId = null;
  let finalPaymentId = null;

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
      firstName: 'Kunal',
      lastName: 'Mehra',
      email: 'kunal.payment.test@example.com',
      phone: '+91 9811223344',
      idType: 'Aadhar Card',
      idNumber: '3344-5566-7788',
      address: '22 Park Street, Kolkata',
      nationality: 'Indian',
    }, token);

    if (guestRes.status === 201) {
      testGuestId = guestRes.body?.data?.id;
    } else {
      const existing = await query("SELECT id FROM guests WHERE email = 'kunal.payment.test@example.com' LIMIT 1");
      testGuestId = existing.rows[0].id;
    }
    console.log(`✅ Using Test Guest ID: ${testGuestId}`);

    // 4. Select Available Room
    console.log('\n[4] Querying available room in PostgreSQL...');
    const roomRes = await query("SELECT id, room_number, price_per_night, status FROM rooms WHERE status = 'available' LIMIT 1");
    if (roomRes.rows.length === 0) {
      throw new Error('No available rooms found for testing.');
    }
    testRoomId = roomRes.rows[0].id;
    const roomNumber = roomRes.rows[0].room_number;
    console.log(`✅ Selected Test Room: ID ${testRoomId}, Room #${roomNumber}`);

    // 5. Create Test Reservation (Total: ₹3600, Advance: ₹1000)
    console.log('\n[5] Creating Test Reservation (Total: ₹3600, Advance Paid: ₹1000)...');
    const createRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: '2027-03-01',
      checkOutDate: '2027-03-04',
      totalAmount: 3600,
      advanceAmount: 1000,
      paymentMethod: 'cash',
      notes: 'Payment test reservation',
    }, token);

    if (createRes.status !== 201 || !createRes.body?.data?.id) {
      throw new Error('Failed to create reservation: ' + JSON.stringify(createRes.body));
    }
    testReservationId = createRes.body.data.id;
    console.log(`✅ Test Reservation created successfully with ID: ${testReservationId}`);

    // 6. Test GET /api/payments (Directory)
    console.log('\n[6] Testing GET /api/payments (Directory Listing)...');
    const listRes = await request('GET', '/api/payments', null, token);
    console.log(`GET /api/payments status: ${listRes.status}, Total count: ${listRes.body?.data?.length}`);
    const foundAdvance = listRes.body?.data?.find((p) => p.reservation_id === testReservationId);
    if (!foundAdvance) {
      throw new Error(`Advance payment for reservation #${testReservationId} not found in directory.`);
    }
    console.log('✅ Advance payment verified in directory:', {
      id: foundAdvance.id,
      amount: foundAdvance.amount,
      method: foundAdvance.payment_method,
      status: foundAdvance.payment_status,
    });

    // 7. Test GET /api/payments/stats (Dashboard Metrics)
    console.log('\n[7] Testing GET /api/payments/stats (KPI Summary Metrics)...');
    const statsRes = await request('GET', '/api/payments/stats', null, token);
    console.log(`Stats status: ${statsRes.status}, Data:`, {
      totalReceived: statsRes.body?.data?.totalReceived,
      todayCollections: statsRes.body?.data?.todayCollections,
      pendingBalances: statsRes.body?.data?.pendingBalances,
      methodTotals: statsRes.body?.data?.methodTotals,
    });
    if (statsRes.status !== 200 || typeof statsRes.body?.data?.totalReceived !== 'number') {
      throw new Error('Failed to retrieve payment dashboard statistics.');
    }
    console.log('✅ Dashboard KPI metrics API verified.');

    // 8. Test GET /api/payments/pending-reservations
    console.log('\n[8] Testing GET /api/payments/pending-reservations (Outstanding Balances)...');
    const pendingRes = await request('GET', '/api/payments/pending-reservations', null, token);
    console.log(`Pending count: ${pendingRes.body?.data?.length}`);
    const ourPending = pendingRes.body?.data?.find((r) => r.reservation_id === testReservationId);
    if (!ourPending) {
      throw new Error(`Reservation #${testReservationId} not found in pending balance reservations.`);
    }
    console.log('Pending Folio Balance:', {
      resId: ourPending.reservation_id,
      guest: `${ourPending.first_name} ${ourPending.last_name}`,
      total: ourPending.booking_total,
      paid: ourPending.total_paid,
      due: ourPending.outstanding_balance,
    });
    if (parseFloat(ourPending.outstanding_balance) !== 2600) {
      throw new Error(`Expected balance ₹2600, got ₹${ourPending.outstanding_balance}`);
    }
    console.log('✅ Outstanding balance calculation verified (₹2600 due).');

    // 9. Negative Test: Invalid / Zero / Negative Amount
    console.log('\n[9] Negative Test: Submitting Invalid Amount (should return 400)...');
    const invalidAmtRes = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: -500,
      paymentMethod: 'upi',
    }, token);
    console.log(`Negative amount status: ${invalidAmtRes.status} (Expected: 400)`);
    if (invalidAmtRes.status !== 400) {
      throw new Error(`Expected 400 for negative amount, got ${invalidAmtRes.status}`);
    }
    console.log('✅ Negative amount strictly rejected.');

    // 10. Negative Test: Overpayment Prevention
    console.log('\n[10] Negative Test: Overpayment Prevention (attempting ₹5000 when due is ₹2600)...');
    const overpayRes = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: 5000,
      paymentMethod: 'upi',
    }, token);
    console.log(`Overpayment status: ${overpayRes.status} (Expected: 400)`);
    if (overpayRes.status !== 400) {
      throw new Error(`Expected 400 for overpayment, got ${overpayRes.status}`);
    }
    console.log(`Overpayment message: "${overpayRes.body?.message}"`);
    console.log('✅ Overpayment strictly detected and prevented.');

    // 11. Record Valid Payment (₹1500 via UPI)
    console.log('\n[11] Testing POST /api/payments (Recording ₹1500 via UPI)...');
    const payRes1 = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: 1500,
      paymentMethod: 'upi',
      transactionId: 'UPI-TEST-9988',
      notes: 'Guest scanned QR at reception',
    }, token);

    console.log(`POST /api/payments status: ${payRes1.status}`);
    if (payRes1.status !== 201 || !payRes1.body?.data?.id) {
      throw new Error('Failed to record payment: ' + JSON.stringify(payRes1.body));
    }
    createdPaymentId = payRes1.body.data.id;
    console.log(`✅ Payment recorded successfully with ID: ${createdPaymentId}`);

    // 12. Test GET /api/payments/:id (Printable Receipt Folio)
    console.log(`\n[12] Testing GET /api/payments/${createdPaymentId} (Receipt Folio)...`);
    const receiptRes = await request('GET', `/api/payments/${createdPaymentId}`, null, token);
    console.log(`Receipt status: ${receiptRes.status}`);
    if (receiptRes.status !== 200 || receiptRes.body?.data?.id !== createdPaymentId) {
      throw new Error('Failed to retrieve receipt folio.');
    }
    console.log('Receipt Details:', {
      id: receiptRes.body.data.id,
      guest: `${receiptRes.body.data.first_name} ${receiptRes.body.data.last_name}`,
      room: receiptRes.body.data.room_number,
      amount: receiptRes.body.data.amount,
      total_paid_so_far: receiptRes.body.data.total_paid_so_far,
      method: receiptRes.body.data.payment_method,
    });
    console.log('✅ Official receipt folio details verified.');

    // 13. Record Final Balance Payment (₹1100 via Credit Card)
    console.log('\n[13] Testing POST /api/payments (Settling final ₹1100 via Credit Card)...');
    const payRes2 = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: 1100,
      paymentMethod: 'credit_card',
      transactionId: 'CC-AUTH-7788',
      notes: 'Visa Platinum Card settlement',
    }, token);

    console.log(`POST final payment status: ${payRes2.status}`);
    if (payRes2.status !== 201 || !payRes2.body?.data?.id) {
      throw new Error('Failed to record final payment');
    }
    finalPaymentId = payRes2.body.data.id;
    console.log(`✅ Final balance settled. Payment ID: ${finalPaymentId}`);

    // 14. Negative Test: Attempt Payment when Balance is 0
    console.log('\n[14] Negative Test: Attempting Payment on Fully Settled Folio (should return 400)...');
    const settledPayRes = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: 200,
      paymentMethod: 'cash',
    }, token);
    console.log(`Fully settled payment status: ${settledPayRes.status} (Expected: 400)`);
    if (settledPayRes.status !== 400) {
      throw new Error(`Expected 400 for settled folio payment, got ${settledPayRes.status}`);
    }
    console.log('✅ Excess payment on fully settled folio strictly blocked.');

    // 15. Search & Filter Testing
    console.log('\n[15] Testing Search & Channel Filters...');
    const searchRes = await request('GET', '/api/payments?search=Kunal', null, token);
    console.log(`Search by guest name: Found ${searchRes.body?.data?.length} payments`);
    if (searchRes.body?.data?.length < 3) {
      throw new Error('Expected at least 3 payments for Kunal Mehra');
    }

    const upiFilterRes = await request('GET', '/api/payments?method=upi', null, token);
    console.log(`Filter by UPI: Found ${upiFilterRes.body?.data?.length} payments`);
    const foundUpi = upiFilterRes.body?.data?.some((p) => p.id === createdPaymentId);
    if (!foundUpi) throw new Error('Expected created UPI payment in filtered result.');
    console.log('✅ Search and channel filters verified.');

    // 16. Test Refund Workflow (Controlled Reversal of final payment)
    console.log(`\n[16] Testing POST /api/payments/${finalPaymentId}/refund (Controlled Refund)...`);
    const refundRes = await request('POST', `/api/payments/${finalPaymentId}/refund`, {
      reason: 'Guest card charged twice by POS - authorized refund',
    }, token);

    console.log(`Refund status: ${refundRes.status}`);
    if (refundRes.status !== 200 || refundRes.body?.data?.payment_status !== 'refunded') {
      throw new Error('Failed to process refund: ' + JSON.stringify(refundRes.body));
    }
    console.log(`✅ Payment #${finalPaymentId} status successfully transitioned to REFUNDED.`);

    // 17. Negative Test: Duplicate Refund Prevention
    console.log('\n[17] Negative Test: Attempting Duplicate Refund (should return 400)...');
    const dupRefundRes = await request('POST', `/api/payments/${finalPaymentId}/refund`, {
      reason: 'Attempting second refund',
    }, token);
    console.log(`Duplicate refund status: ${dupRefundRes.status} (Expected: 400)`);
    if (dupRefundRes.status !== 400) {
      throw new Error(`Expected 400 for duplicate refund, got ${dupRefundRes.status}`);
    }
    console.log(`Duplicate refund message: "${dupRefundRes.body?.message}"`);
    console.log('✅ Duplicate refund strictly prevented.');

    // 18. Verify Stats after Refund
    console.log('\n[18] Verifying Refund Metrics in Dashboard Stats...');
    const postRefundStats = await request('GET', '/api/payments/stats', null, token);
    console.log('Refund Metrics:', {
      totalRefunds: postRefundStats.body?.data?.totalRefunds,
      countRefunded: postRefundStats.body?.data?.countRefunded,
    });
    if (postRefundStats.body?.data?.totalRefunds < 1100) {
      throw new Error('Expected total refunds to reflect refunded amount.');
    }
    console.log('✅ Refund audit reflected in treasury statistics.');

    // 19. Clean up test records safely
    console.log('\n[19] Safely cleaning up test records from PostgreSQL...');
    await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
    await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
    if (testGuestId) {
      await query("DELETE FROM guests WHERE email = 'kunal.payment.test@example.com'");
    }
    console.log('✅ Test data cleanly removed.');

    console.log('\n====================================================');
    console.log('🎉 ALL 19 PAYMENTS MODULE TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    if (testReservationId) {
      try {
        await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
        await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
      } catch (_) {}
    }
    if (testGuestId) {
      try { await query("DELETE FROM guests WHERE email = 'kunal.payment.test@example.com'"); } catch (_) {}
    }
    process.exit(1);
  }
}

runPaymentTests();
