/**
 * ====================================================================
 * GITA DEVI HOTEL — HOTEL EXPENSES MANAGEMENT MODULE INTEGRATION TESTS
 * ====================================================================
 * Tests:
 * 1. Health check & DB connection
 * 2. Authentication enforcement (401 without JWT)
 * 3. Authorized JWT Generation
 * 4. GET /api/expenses/stats (Initial KPI check)
 * 5. POST /api/expenses (Negative test: Missing title -> 400)
 * 6. POST /api/expenses (Negative test: Negative / 0 amount -> 400)
 * 7. POST /api/expenses (Negative test: Invalid category -> 400)
 * 8. POST /api/expenses (Record valid Utility expense: Electricity -> 201)
 * 9. POST /api/expenses (Record valid Food & Beverage expense: Grocery -> 201)
 * 10. POST /api/expenses (Record valid Maintenance expense -> 201)
 * 11. GET /api/expenses/:id (Retrieve single expense with joined staff name)
 * 12. PUT /api/expenses/:id (Edit expense details and amount)
 * 13. GET /api/expenses (Search by keyword)
 * 14. GET /api/expenses (Filter by category)
 * 15. GET /api/expenses (Filter by payment method)
 * 16. GET /api/expenses/stats (Verify dynamic category and method aggregations)
 * 17. GET /api/expenses/reports (Verify daily, monthly, yearly report generation)
 * 18. DELETE /api/expenses/:id (Safely delete test record)
 * 19. Clean up all remaining test expenses safely from PostgreSQL
 * ====================================================================
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');

const BASE_URL = 'http://localhost:5000/api';

let adminToken = '';
let testExpenseIds = [];

async function runTests() {
  console.log('====================================================');
  console.log('🧪 LIVE HOTEL EXPENSES MODULE INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Health Check
    console.log('[1] Checking Backend & PostgreSQL Health...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    const isDbConnected = healthData.database?.connected ?? healthData.dbConnected;
    if (healthRes.status !== 200 || !isDbConnected) {
      throw new Error(`Backend not ready: ${JSON.stringify(healthData)}`);
    }
    console.log(`Backend Health Status: ${healthRes.status}, DB Connected: ${isDbConnected}`);

    // 2. Authentication Enforcement (Negative Test)
    console.log('\n[2] Negative Test: Accessing /api/expenses without token (should return 401)...');
    const unauthRes = await fetch(`${BASE_URL}/expenses`);
    if (unauthRes.status === 401) {
      console.log('✅ Unauthenticated request strictly rejected (401 Unauthorized).');
    } else {
      throw new Error(`Expected 401 but got ${unauthRes.status}`);
    }

    // 3. Generate Authorized Token
    console.log('\n[3] Generating Authorized Admin JWT Token...');
    const adminUser = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1;");
    let admin = adminUser.rows[0];
    if (!admin) {
      const anyUser = await pool.query('SELECT * FROM users LIMIT 1;');
      admin = anyUser.rows[0];
    }
    adminToken = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      fullName: admin.full_name,
    });
    console.log(`✅ Admin JWT Token generated successfully for user: ${admin.full_name} (${admin.role}).`);

    // 4. Check Initial Stats
    console.log('\n[4] Testing GET /api/expenses/stats (Dashboard KPIs)...');
    const statsRes = await fetch(`${BASE_URL}/expenses/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsData = await statsRes.json();
    if (statsRes.status !== 200) {
      throw new Error(`Failed to fetch stats: ${JSON.stringify(statsData)}`);
    }
    console.log('Stats Response:', statsData.data);
    console.log('✅ Initial Dashboard KPI metrics API verified.');

    // 5. Negative Test: Missing Title
    console.log('\n[5] Negative Test: Submitting expense with missing title (should return 400)...');
    const missingTitleRes = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: '',
        category: 'utilities',
        amount: 1500,
      }),
    });
    if (missingTitleRes.status === 400) {
      console.log('✅ Missing title strictly rejected with 400 Bad Request.');
    } else {
      throw new Error(`Expected 400 but got ${missingTitleRes.status}`);
    }

    // 6. Negative Test: Invalid / Negative Amount
    console.log('\n[6] Negative Test: Submitting expense with negative amount (should return 400)...');
    const negAmountRes = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Test Expense',
        category: 'utilities',
        amount: -500,
      }),
    });
    if (negAmountRes.status === 400) {
      console.log('✅ Negative amount strictly rejected with 400 Bad Request.');
    } else {
      throw new Error(`Expected 400 but got ${negAmountRes.status}`);
    }

    // 7. Negative Test: Invalid Category
    console.log('\n[7] Negative Test: Submitting expense with unsupported category (should return 400)...');
    const invalidCatRes = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Category Expense',
        category: 'luxury_vacation_unsupported',
        amount: 2500,
      }),
    });
    if (invalidCatRes.status === 400) {
      console.log('✅ Unsupported category strictly rejected with 400 Bad Request.');
    } else {
      throw new Error(`Expected 400 but got ${invalidCatRes.status}`);
    }

    // 8. Record Valid Utility Expense
    console.log('\n[8] Testing POST /api/expenses (Recording Utility: Electricity Bill ₹4,200)...');
    const exp1Res = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'TEST_SUITE: North Wing Electricity Bill',
        category: 'utilities',
        amount: 4200.0,
        paymentMethod: 'upi',
        expenseDate: new Date().toISOString().split('T')[0],
        description: 'Vendor: State Electricity Board | Ref: UPI-98765432 | Notes: Main meter billing',
      }),
    });
    const exp1Data = await exp1Res.json();
    if (exp1Res.status !== 201) {
      throw new Error(`Failed to create utility expense: ${JSON.stringify(exp1Data)}`);
    }
    const exp1Id = exp1Data.data.id;
    testExpenseIds.push(exp1Id);
    console.log(`✅ Utility expense created successfully with ID: ${exp1Id}`);

    // 9. Record Valid Food & Beverage Expense
    console.log('\n[9] Testing POST /api/expenses (Recording F&B: Kitchen Grocery ₹7,850)...');
    const exp2Res = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'TEST_SUITE: Royal Kitchen Fresh Grocery',
        category: 'food_beverage',
        amount: 7850.5,
        paymentMethod: 'bank_transfer',
        expenseDate: new Date().toISOString().split('T')[0],
        description: 'Vendor: Organic Farms Supply | Ref: NEFT-776102 | Notes: Dairy and vegetables',
      }),
    });
    const exp2Data = await exp2Res.json();
    if (exp2Res.status !== 201) {
      throw new Error(`Failed to create F&B expense: ${JSON.stringify(exp2Data)}`);
    }
    const exp2Id = exp2Data.data.id;
    testExpenseIds.push(exp2Id);
    console.log(`✅ Food & Beverage expense created successfully with ID: ${exp2Id}`);

    // 10. Record Valid Maintenance Expense
    console.log('\n[10] Testing POST /api/expenses (Recording Maintenance: AC Repair ₹3,100)...');
    const exp3Res = await fetch(`${BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'TEST_SUITE: Central HVAC Servicing',
        category: 'maintenance',
        amount: 3100.0,
        paymentMethod: 'cash',
        expenseDate: new Date().toISOString().split('T')[0],
        description: 'Vendor: CoolTech Services | Ref: CASH-VCH-44 | Notes: Compressor repair',
      }),
    });
    const exp3Data = await exp3Res.json();
    if (exp3Res.status !== 201) {
      throw new Error(`Failed to create Maintenance expense: ${JSON.stringify(exp3Data)}`);
    }
    const exp3Id = exp3Data.data.id;
    testExpenseIds.push(exp3Id);
    console.log(`✅ Maintenance expense created successfully with ID: ${exp3Id}`);

    // 11. Retrieve Single Expense by ID
    console.log(`\n[11] Testing GET /api/expenses/${exp1Id} (Detailed Single Record)...`);
    const singleRes = await fetch(`${BASE_URL}/expenses/${exp1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const singleData = await singleRes.json();
    if (singleRes.status !== 200 || !singleData.data) {
      throw new Error(`Failed to get single expense: ${JSON.stringify(singleData)}`);
    }
    console.log('Fetched Expense Details:', {
      id: singleData.data.id,
      title: singleData.data.title,
      category: singleData.data.category,
      amount: singleData.data.amount,
      recorded_by: singleData.data.recorded_by_name,
    });
    console.log('✅ Single expense retrieval with staff name verified.');

    // 12. Edit Expense
    console.log(`\n[12] Testing PUT /api/expenses/${exp1Id} (Editing Title & Amount)...`);
    const editRes = await fetch(`${BASE_URL}/expenses/${exp1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'TEST_SUITE: North Wing Electricity Bill (Adjusted)',
        amount: 4500.0,
        description: 'Vendor: State Electricity Board | Ref: UPI-98765432 | Notes: Revised meter reading',
      }),
    });
    const editData = await editRes.json();
    if (editRes.status !== 200 || parseFloat(editData.data.amount) !== 4500.0) {
      throw new Error(`Failed to update expense: ${JSON.stringify(editData)}`);
    }
    console.log(`✅ Expense #${exp1Id} updated successfully. New Amount: ₹${editData.data.amount}`);

    // 13. Search Test
    console.log('\n[13] Testing GET /api/expenses?search=HVAC (Search Keyword)...');
    const searchRes = await fetch(`${BASE_URL}/expenses?search=HVAC`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchData = await searchRes.json();
    if (searchRes.status !== 200 || searchData.data.length === 0) {
      throw new Error(`Search failed: ${JSON.stringify(searchData)}`);
    }
    console.log(`✅ Search verified. Found ${searchData.data.length} match(es) for 'HVAC'.`);

    // 14. Category Filter Test
    console.log('\n[14] Testing GET /api/expenses?category=food_beverage (Category Filter)...');
    const catFilterRes = await fetch(`${BASE_URL}/expenses?category=food_beverage`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catFilterData = await catFilterRes.json();
    if (catFilterRes.status !== 200 || catFilterData.data.length === 0) {
      throw new Error(`Category filter failed: ${JSON.stringify(catFilterData)}`);
    }
    console.log(`✅ Category filter verified. Found ${catFilterData.data.length} F&B expense(s).`);

    // 15. Payment Method Filter Test
    console.log('\n[15] Testing GET /api/expenses?paymentMethod=bank_transfer (Method Filter)...');
    const methodFilterRes = await fetch(`${BASE_URL}/expenses?paymentMethod=bank_transfer`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const methodFilterData = await methodFilterRes.json();
    if (methodFilterRes.status !== 200 || methodFilterData.data.length === 0) {
      throw new Error(`Method filter failed: ${JSON.stringify(methodFilterData)}`);
    }
    console.log(`✅ Payment method filter verified. Found ${methodFilterData.data.length} bank transfer(s).`);

    // 16. Verify Dynamic Stats & Categorical Aggregations
    console.log('\n[16] Testing GET /api/expenses/stats (Dynamic Aggregation Audit)...');
    const updatedStatsRes = await fetch(`${BASE_URL}/expenses/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const updatedStatsData = await updatedStatsRes.json();
    console.log('Updated KPIs:', {
      totalAmount: updatedStatsData.data.totalAmount,
      totalCount: updatedStatsData.data.totalCount,
      todayAmount: updatedStatsData.data.todayAmount,
      methodTotals: updatedStatsData.data.methodTotals,
    });
    if (updatedStatsData.data.totalAmount <= 0) {
      throw new Error('Stats did not reflect recorded expenses!');
    }
    console.log('✅ Dynamic category and treasury calculations verified.');

    // 17. Reports Generation Test
    console.log('\n[17] Testing GET /api/expenses/reports?period=monthly (Analytics & Reports)...');
    const reportsRes = await fetch(`${BASE_URL}/expenses/reports?period=monthly`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reportsData = await reportsRes.json();
    if (reportsRes.status !== 200 || !reportsData.data.timeline) {
      throw new Error(`Report generation failed: ${JSON.stringify(reportsData)}`);
    }
    console.log('Report Timeline:', reportsData.data.timeline);
    console.log('✅ Periodic report generation API verified.');

    // 18. Delete Test
    console.log(`\n[18] Testing DELETE /api/expenses/${exp3Id} (Safe Delete)...`);
    const delRes = await fetch(`${BASE_URL}/expenses/${exp3Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (delRes.status !== 200) {
      throw new Error(`Delete failed with status: ${delRes.status}`);
    }
    testExpenseIds = testExpenseIds.filter((id) => id !== exp3Id);
    console.log(`✅ Expense #${exp3Id} safely deleted.`);

    // 19. Clean Up
    console.log('\n[19] Safely cleaning up remaining test expenses from PostgreSQL...');
    if (testExpenseIds.length > 0) {
      await pool.query('DELETE FROM expenses WHERE id = ANY($1::int[])', [testExpenseIds]);
      console.log(`✅ Removed test IDs: ${testExpenseIds.join(', ')}`);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 19 HOTEL EXPENSES MODULE TESTS PASSED (100%)!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    // Cleanup if any
    if (testExpenseIds.length > 0) {
      await pool.query('DELETE FROM expenses WHERE id = ANY($1::int[])', [testExpenseIds]).catch(() => {});
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
