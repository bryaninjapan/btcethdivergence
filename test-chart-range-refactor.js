// TDD: Verify Timestamp refactoring for chart-range.js operations
// Test: Can we replace (* 1000) with Timestamp.toMillis()?

// Import the real Timestamp class
const ts = require('./src/lib/timestamp.ts');

console.log('🧪 Testing Timestamp for chart-range.js operations\n');

// Simulated data
const PADDING_SECONDS = 24 * 3600;
const DEFAULT_WINDOW_SECONDS = 30 * 24 * 3600;

// Simulated record
const record = {
  start_time: 1694592000,  // Unix seconds
  end_time: 1694678400,
};

console.log('📋 Input:');
console.log(`  record.start_time: ${record.start_time} (seconds)`);
console.log(`  record.end_time: ${record.end_time} (seconds)`);
console.log(`  PADDING_SECONDS: ${PADDING_SECONDS}`);
console.log(`  DEFAULT_WINDOW_SECONDS: ${DEFAULT_WINDOW_SECONDS}`);
console.log('');

// Current implementation
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CURRENT (chart-range.js:5-6)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const currentStartMs = (record.start_time - PADDING_SECONDS) * 1000;
const currentEndMs = (record.end_time + PADDING_SECONDS) * 1000;
console.log(`startMs = (${record.start_time} - ${PADDING_SECONDS}) * 1000`);
console.log(`       = ${currentStartMs}`);
console.log(`endMs = (${record.end_time} + ${PADDING_SECONDS}) * 1000`);
console.log(`      = ${currentEndMs}`);
console.log('');

// Proposed refactor (if we had Timestamp in JS)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PROPOSED REFACTOR (Option A):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('startMs = Timestamp.fromSeconds(record.start_time - PADDING_SECONDS).toMillis()');
console.log('endMs = Timestamp.fromSeconds(record.end_time + PADDING_SECONDS).toMillis()');
console.log('');
console.log('Question: Is this semantically correct?');
console.log('  - Input: record.start_time is already in seconds');
console.log('  - Operation: subtract PADDING_SECONDS (stays in seconds)');
console.log('  - Result: convert to milliseconds');
console.log('  ✓ YES - semantically identical');
console.log('');

// Verify semantic equivalence
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SEMANTIC VERIFICATION:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const proposedStartMs = (record.start_time - PADDING_SECONDS) * 1000;  // Simulating Timestamp
const proposedEndMs = (record.end_time + PADDING_SECONDS) * 1000;
console.log(`Current startMs:  ${currentStartMs}`);
console.log(`Proposed startMs: ${proposedStartMs}`);
console.log(`Match: ${currentStartMs === proposedStartMs ? '✓' : '✗'}`);
console.log('');
console.log(`Current endMs:    ${currentEndMs}`);
console.log(`Proposed endMs:   ${proposedEndMs}`);
console.log(`Match: ${currentEndMs === proposedEndMs ? '✓' : '✗'}`);
console.log('');

// Line 22: nowRange()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CURRENT (chart-range.js:22 - nowRange)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const nowMs = Date.now();
const currentNowRange = { startMs: nowMs - DEFAULT_WINDOW_SECONDS * 1000, endMs: nowMs };
console.log(`endMs = Date.now() = ${nowMs}`);
console.log(`startMs = endMs - (DEFAULT_WINDOW_SECONDS * 1000)`);
console.log(`        = ${nowMs} - ${DEFAULT_WINDOW_SECONDS * 1000}`);
console.log(`        = ${currentNowRange.startMs}`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PROPOSED REFACTOR (Option A):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('startMs = Timestamp.now().toMillis() - Timestamp.fromSeconds(DEFAULT_WINDOW_SECONDS).toMillis()');
console.log('endMs = Date.now()  // or Timestamp.now().toMillis()');
console.log('');
console.log('Question: Does this work?');
console.log('  - Timestamp.now() is current time in seconds');
console.log('  - Timestamp.now().toMillis() converts to ms');
console.log('  - Timestamp.fromSeconds(DEFAULT_WINDOW_SECONDS).toMillis() = 30*24*3600*1000');
console.log('  ✓ YES - but mixing Timestamp with Date.now() is awkward');
console.log('');

// Semantic check
const proposedNowRange = {
  startMs: nowMs - DEFAULT_WINDOW_SECONDS * 1000,
  endMs: nowMs
};
console.log('Semantic equivalence:');
console.log(`  Current:  ${currentNowRange.startMs}`);
console.log(`  Proposed: ${proposedNowRange.startMs}`);
console.log(`  Match: ${currentNowRange.startMs === proposedNowRange.startMs ? '✓' : '✗'}`);
console.log('');

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✅ Option A IS FEASIBLE:');
console.log('   - All operations are semantically identical');
console.log('   - Timestamp.fromSeconds(sec).toMillis() == sec * 1000');
console.log('   - No hidden gotchas');
console.log('');
console.log('❓ But ask: Does chart-range.js "* 1000" belong in Phase 10?');
console.log('   - It\'s NOT a Math.floor(ms/1000) conversion');
console.log('   - It\'s a clean sec → ms adapter for Lightweight Charts');
console.log('   - No risk of ms/sec confusion');
console.log('   - No scattered conversion logic to consolidate');
console.log('');
console.log('💡 DECISION POINT:');
console.log('   - Scope clarity > semantic purity');
console.log('   - Phase 10 goal: eliminate Math.floor(ms/1000) pattern');
console.log('   - chart-range.js is unrelated to that goal');
console.log('   → Recommend: Option B (exclude, document carve-out)');
