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

async function runInvoiceTests() {
  console.log('====================================================');
  console.log('🧪 LIVE INVOICES & BILLING MODULE INTEGRATION TESTS');
  console.log('====================================================\n');

  let testGuestId = null;
  let testRoomId = null;
  let testReservationId = null;
  let createdInvoiceId = null;
  let initialPaymentsCount = 0;

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
      firstName: 'Aditya',
      lastName: 'Roy',
      email: 'aditya.invoice.test@example.com',
      phone: '+91 9776655443',
      idType: 'Passport',
      idNumber: 'K1234567',
      address: '15 Jubilee Hills, Hyderabad',
      nationality: 'Indian',
    }, token);

    if (guestRes.status === 201) {
      testGuestId = guestRes.body?.data?.id;
    } else {
      const existing = await query("SELECT id FROM guests WHERE email = 'aditya.invoice.test@example.com' LIMIT 1");
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

    // 5. Create Test Reservation (3 nights, ₹3600 total, ₹1000 advance)
    console.log('\n[5] Creating Test Reservation for Invoicing...');
    const createRes = await request('POST', '/api/reservations', {
      guestId: testGuestId,
      roomId: testRoomId,
      checkInDate: '2027-04-10',
      checkOutDate: '2027-04-13',
      totalAmount: 3600,
      advanceAmount: 1000,
      paymentMethod: 'cash',
      notes: 'Invoice billing test reservation',
    }, token);

    if (createRes.status !== 201 || !createRes.body?.data?.id) {
      throw new Error('Failed to create reservation: ' + JSON.stringify(createRes.body));
    }
    testReservationId = createRes.body.data.id;
    console.log(`✅ Test Reservation created successfully with ID: ${testReservationId}`);

    // Count payments recorded so far for this reservation
    const initialPayRes = await query('SELECT COUNT(*) FROM payments WHERE reservation_id = $1', [testReservationId]);
    initialPaymentsCount = parseInt(initialPayRes.rows[0].count, 10);
    console.log(`Initial Payments count in DB for Reservation #${testReservationId}: ${initialPaymentsCount} (Advance payment)`);

    // 6. Test GET /api/invoices/eligible-reservations
    console.log('\n[6] Testing GET /api/invoices/eligible-reservations (Awaiting Invoices)...');
    const eligibleRes = await request('GET', '/api/invoices/eligible-reservations', null, token);
    console.log(`Eligible count: ${eligibleRes.body?.data?.length}`);
    const foundEligible = eligibleRes.body?.data?.find((r) => r.reservation_id === testReservationId);
    if (!foundEligible) {
      throw new Error(`Expected reservation #${testReservationId} in eligible invoices list.`);
    }
    console.log('✅ Eligible reservation found awaiting invoice:', {
      resId: foundEligible.reservation_id,
      guest: `${foundEligible.first_name} ${foundEligible.last_name}`,
      room: foundEligible.room_number,
      total: foundEligible.booking_total,
      paid: foundEligible.total_paid,
    });

    // 7. Test GET /api/invoices/stats
    console.log('\n[7] Testing GET /api/invoices/stats (Billing Dashboard Metrics)...');
    const statsRes = await request('GET', '/api/invoices/stats', null, token);
    console.log(`Stats status: ${statsRes.status}, Data:`, statsRes.body?.data);
    if (statsRes.status !== 200 || typeof statsRes.body?.data?.totalInvoices !== 'number') {
      throw new Error('Failed to retrieve billing dashboard statistics.');
    }
    console.log('✅ Billing dashboard stats verified.');

    // 8. Generate Invoice (Subtotal: ₹3600, Discount: ₹100, Tax: 0% unconfigured -> Total: ₹3500)
    console.log('\n[8] Testing POST /api/invoices/generate (Generating Invoice)...');
    const genRes = await request('POST', '/api/invoices/generate', {
      reservationId: testReservationId,
      discountAmount: 100,
      taxPercent: 0, // Unconfigured tax rate (Rule #5, #6, #7)
      dueDate: '2027-04-20',
    }, token);

    console.log(`POST /invoices/generate status: ${genRes.status}`);
    if (genRes.status !== 201 || !genRes.body?.data?.id) {
      throw new Error('Failed to generate invoice: ' + JSON.stringify(genRes.body));
    }
    createdInvoiceId = genRes.body.data.id;
    const inv = genRes.body.data;
    console.log('✅ Invoice generated successfully:', {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      subtotal: inv.subtotal,
      discount: inv.discount_amount,
      tax: inv.tax_amount,
      total: inv.total_amount,
      status: inv.payment_status,
    });

    if (parseFloat(inv.total_amount) !== 3500) {
      throw new Error(`Expected grand total ₹3500, got ₹${inv.total_amount}`);
    }
    if (inv.payment_status !== 'partial') {
      throw new Error(`Expected status 'partial' (₹1000 paid of ₹3500), got '${inv.payment_status}'`);
    }

    // 9. VERIFY RULE #10: Ensure NO duplicate payment was created during invoice generation!
    console.log('\n[9] VERIFYING RULE #10: Verifying zero duplicate payments created...');
    const postGenPayRes = await query('SELECT COUNT(*) FROM payments WHERE reservation_id = $1', [testReservationId]);
    const postGenPaymentsCount = parseInt(postGenPayRes.rows[0].count, 10);
    console.log(`Payments count in DB after invoice generation: ${postGenPaymentsCount}`);
    if (postGenPaymentsCount !== initialPaymentsCount) {
      throw new Error(`VIOLATION OF RULE #10: A duplicate payment was inserted during invoice generation!`);
    }
    console.log('✅ Rule #10 PASSED: No duplicate payment records created during invoicing.');

    // 10. Negative Test: Duplicate Invoice Prevention (Rule #9)
    console.log('\n[10] Negative Test: Duplicate Invoice Prevention (should return 409)...');
    const dupInvRes = await request('POST', '/api/invoices/generate', {
      reservationId: testReservationId,
    }, token);
    console.log(`Duplicate invoice generation status: ${dupInvRes.status} (Expected: 409)`);
    if (dupInvRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate invoice generation, got ${dupInvRes.status}`);
    }
    console.log(`Duplicate rejection message: "${dupInvRes.body?.message}"`);
    console.log('✅ Duplicate invoice strictly prevented.');

    // 11. Test GET /api/invoices (Directory Listing)
    console.log('\n[11] Testing GET /api/invoices (Directory Listing)...');
    const listRes = await request('GET', '/api/invoices', null, token);
    console.log(`GET /api/invoices status: ${listRes.status}, Count: ${listRes.body?.data?.length}`);
    const foundInvoice = listRes.body?.data?.find((i) => i.id === createdInvoiceId);
    if (!foundInvoice) {
      throw new Error(`Invoice ID ${createdInvoiceId} not found in directory listing.`);
    }
    console.log('✅ Invoice verified in directory:', {
      number: foundInvoice.invoice_number,
      guest: `${foundInvoice.first_name} ${foundInvoice.last_name}`,
      room: foundInvoice.room_number,
      total: foundInvoice.total_amount,
      paid: foundInvoice.total_paid,
      status: foundInvoice.payment_status,
    });

    // 12. Test GET /api/invoices/:id (Printable Folio Details)
    console.log(`\n[12] Testing GET /api/invoices/${createdInvoiceId} (Full Folio & Payments)...`);
    const singleRes = await request('GET', `/api/invoices/${createdInvoiceId}`, null, token);
    console.log(`Single invoice status: ${singleRes.status}`);
    if (singleRes.status !== 200 || singleRes.body?.data?.id !== createdInvoiceId) {
      throw new Error('Failed to retrieve single invoice details.');
    }
    console.log('Invoice Folio:', {
      invoice_number: singleRes.body.data.invoice_number,
      guest: `${singleRes.body.data.first_name} ${singleRes.body.data.last_name}`,
      room: singleRes.body.data.room_number,
      subtotal: singleRes.body.data.subtotal,
      total_paid: singleRes.body.data.total_paid,
      paymentsCount: singleRes.body.data.payments?.length,
    });
    console.log('✅ Printable invoice folio details verified.');

    // 13. Test GET /api/invoices/reservation/:reservationId
    console.log(`\n[13] Testing GET /api/invoices/reservation/${testReservationId}...`);
    const resInv = await request('GET', `/api/invoices/reservation/${testReservationId}`, null, token);
    console.log(`Reservation invoice status: ${resInv.status}`);
    if (resInv.status !== 200 || resInv.body?.data?.id !== createdInvoiceId) {
      throw new Error('Failed to retrieve invoice by reservation ID.');
    }
    console.log('✅ Invoice by reservation ID verified.');

    // 14. Record Final Settlement Payment (₹2500 via UPI)
    console.log('\n[14] Recording Settlement Payment of ₹2500 via Payments API...');
    const settlePayRes = await request('POST', '/api/payments', {
      reservationId: testReservationId,
      amount: 2500,
      paymentMethod: 'upi',
      transactionId: 'UPI-INV-SETTLE',
      notes: 'Final settlement against invoice',
    }, token);
    console.log(`Settlement payment status: ${settlePayRes.status}`);
    if (settlePayRes.status !== 201) {
      throw new Error('Failed to record settlement payment: ' + JSON.stringify(settlePayRes.body));
    }
    console.log('✅ Settlement payment recorded.');

    // 15. Update Invoice Payment Status to 'paid'
    console.log(`\n[15] Testing PATCH /api/invoices/${createdInvoiceId}/status (Updating to 'paid')...`);
    const patchRes = await request('PATCH', `/api/invoices/${createdInvoiceId}/status`, {
      paymentStatus: 'paid',
    }, token);
    console.log(`PATCH status: ${patchRes.status}`);
    if (patchRes.status !== 200 || patchRes.body?.data?.payment_status !== 'paid') {
      throw new Error('Failed to update invoice status: ' + JSON.stringify(patchRes.body));
    }
    console.log('✅ Invoice status updated to PAID.');

    // 16. Search and Filter Testing
    console.log('\n[16] Testing Search & Status Filters...');
    const searchRes = await request('GET', '/api/invoices?search=Aditya', null, token);
    console.log(`Search by guest name: Found ${searchRes.body?.data?.length} invoices`);
    if (searchRes.body?.data?.length === 0) {
      throw new Error('Expected to find invoice for Aditya Roy.');
    }

    const paidFilterRes = await request('GET', '/api/invoices?paymentStatus=paid', null, token);
    console.log(`Filter by Paid: Found ${paidFilterRes.body?.data?.length} invoices`);
    const foundPaid = paidFilterRes.body?.data?.some((i) => i.id === createdInvoiceId);
    if (!foundPaid) {
      throw new Error('Expected created invoice in paid filter results.');
    }
    console.log('✅ Search and status filters verified.');

    // 17. Safely clean up test records
    console.log('\n[17] Safely cleaning up test records from PostgreSQL...');
    await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
    await query('DELETE FROM invoices WHERE id = $1', [createdInvoiceId]);
    await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
    if (testGuestId) {
      await query("DELETE FROM guests WHERE email = 'aditya.invoice.test@example.com'");
    }
    console.log('✅ Test data cleanly removed from PostgreSQL.');

    console.log('\n====================================================');
    console.log('🎉 ALL 17 INVOICE & BILLING TESTS PASSED PERFECTLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    if (createdInvoiceId) {
      try { await query('DELETE FROM invoices WHERE id = $1', [createdInvoiceId]); } catch (_) {}
    }
    if (testReservationId) {
      try {
        await query('DELETE FROM payments WHERE reservation_id = $1', [testReservationId]);
        await query('DELETE FROM reservations WHERE id = $1', [testReservationId]);
      } catch (_) {}
    }
    if (testGuestId) {
      try { await query("DELETE FROM guests WHERE email = 'aditya.invoice.test@example.com'"); } catch (_) {}
    }
    process.exit(1);
  }
}

runInvoiceTests();
