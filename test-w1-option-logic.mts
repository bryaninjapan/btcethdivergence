// TDD: Test Option A vs Option B for W1 — does Option A conflict with W5?
// Question: If we convert the 3 sec→ms sites, does it create logical conflict with W5's chart-range.js exclusion?

console.log('🧪 Testing W1 Option A vs Option B — Logic Consistency Check\n');

// ============================================================================
// SETUP: W5 Decision (chart-range.js exclusion rationale)
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('W5 DECISION: Exclude chart-range.js');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const W5_RATIONALE = {
  site: 'chart-range.js:5,6,22',
  pattern: '* 1000 (sec → ms)',
  reason: 'Single-purpose adapter for Lightweight Charts rendering',
  phase_goal: 'Eliminate Math.floor(ms/1000) pattern (NOT all time operations)',
};

console.log('W5 says: chart-range.js is EXCLUDED because:');
console.log(`  Pattern: ${W5_RATIONALE.pattern}`);
console.log(`  Reason: ${W5_RATIONALE.reason}`);
console.log(`  Phase Goal: ${W5_RATIONALE.phase_goal}`);
console.log('');

// ============================================================================
// STAGE 1: Categorize the 4 sec→ms sites
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STAGE 1: Categorize all sec→ms sites');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const SEC_TO_MS_SITES = [
  {
    file: 'records.js',
    line: 25,
    code: 'new Date(ts * 1000)',
    function: 'formatTime',
    purpose: 'Display seconds as ISO string',
    type: 'display-adapter',
  },
  {
    file: 'datetime.js',
    line: 46,
    code: 'new Date(ts * 1000)',
    function: 'epochToParts',
    purpose: 'Display seconds as year/month/day',
    type: 'display-adapter',
  },
  {
    file: 'charts.js',
    line: 179,
    code: 'startSec * 1000',
    function: 'event listener (load-range click)',
    purpose: 'Convert seconds to ms for loadRange()',
    type: 'business-logic-adapter',
  },
  {
    file: 'chart-range.js',
    line: '5,6,22',
    code: '* 1000',
    function: 'recordToRange, nowRange',
    purpose: 'Convert seconds to ms for chart rendering',
    type: 'rendering-adapter',
  },
];

for (const site of SEC_TO_MS_SITES) {
  console.log(`${site.file}:${site.line} — ${site.function}()`);
  console.log(`  Code: ${site.code}`);
  console.log(`  Purpose: ${site.purpose}`);
  console.log(`  Type: [${site.type}]`);
  console.log('');
}

// ============================================================================
// STAGE 2: Option A — Convert 3 sites (excluding chart-range.js)
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('OPTION A: Convert 3 sec→ms sites (exclude chart-range.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const OPTION_A = {
  convert: ['records.js:25', 'datetime.js:46', 'charts.js:179'],
  exclude: ['chart-range.js:5,6,22'],
  rationale: 'Convert business logic & display utilities, keep rendering adapter excluded',
};

console.log('Convert:');
for (const site of OPTION_A.convert) {
  console.log(`  ✓ ${site}`);
}
console.log('');
console.log('Exclude:');
for (const site of OPTION_A.exclude) {
  console.log(`  ✗ ${site} (per W5)`);
}
console.log('');
console.log(`Rationale: ${OPTION_A.rationale}`);
console.log('');

// ============================================================================
// STAGE 3: Option B — Narrow SC2 (exclude all sec→ms sites)
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('OPTION B: Narrow SC2 to Math.floor pattern only');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const OPTION_B = {
  convert: [],
  exclude: ['records.js:25', 'datetime.js:46', 'charts.js:179', 'chart-range.js:5,6,22'],
  rationale: 'Phase goal is to eliminate Math.floor(ms/1000), not all sec→ms conversions',
  new_sc2: 'All Math.floor(ms/1000) conversion patterns use Timestamp API',
};

console.log('Convert: [none]');
console.log('');
console.log('Exclude:');
for (const site of OPTION_B.exclude) {
  console.log(`  ✗ ${site} (not Math.floor pattern)`);
}
console.log('');
console.log(`Rationale: ${OPTION_B.rationale}`);
console.log(`New SC2: "${OPTION_B.new_sc2}"`);
console.log('');

// ============================================================================
// STAGE 4: Conflict Analysis
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('STAGE 4: Conflict Analysis');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('Question: Does Option A create logical conflict with W5 decision?');
console.log('');

const OPTION_A_CONFLICTS = [
  {
    issue: 'Mixed Treatment of Adapters',
    detail: 'W5 excludes chart-range.js as "single-purpose adapter", but Option A converts records.js:25 and datetime.js:46, which are ALSO "single-purpose display adapters"',
    severity: '🔴 HIGH',
    explanation: `
      W5 Logic: "chart-range.js is a single-purpose adapter → exclude"
      But: "records.js:25 is new Date(ts * 1000), also a single-purpose adapter"
      Question: Why exclude one adapter but convert another?
      Answer in Option A: No clear answer. Different treatment without principle.`,
  },
  {
    issue: 'Inconsistent Phase Goal Application',
    detail: 'Phase Goal says "eliminate Math.floor(ms/1000) pattern" — not "all time operations". Option A converts sites with ZERO Math.floor.',
    severity: '🟠 MEDIUM',
    explanation: `
      Phase Goal: "Eliminate Math.floor(ms/1000) [scattered] consolidation"
      records.js:25 code: "new Date(ts * 1000)" — Zero Math.floor
      datetime.js:46 code: "new Date(ts * 1000)" — Zero Math.floor
      charts.js:179 code: "startSec * 1000" — Zero Math.floor

      If phase goal is specific to Math.floor, why convert non-Math.floor sites?`,
  },
  {
    issue: 'Unclear Exclusion Boundary',
    detail: 'Why is chart-range.js excluded but charts.js:179 is included? Both are adapters doing sec→ms conversion.',
    severity: '🔴 HIGH',
    explanation: `
      chart-range.js:5 — Rendering adapter: "sec * 1000" → EXCLUDE per W5
      charts.js:179 — Business logic adapter: "sec * 1000" → INCLUDE per Option A?

      The only difference is PURPOSE (rendering vs business logic), not PATTERN.
      But W5 doesn't mention purpose as the deciding factor — it says "adapter" and "not Math.floor".`,
  },
];

for (const conflict of OPTION_A_CONFLICTS) {
  console.log(`${conflict.severity} ${conflict.issue}`);
  console.log(`${conflict.detail}`);
  console.log(`${conflict.explanation}`);
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Option B: Conflict Analysis');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const OPTION_B_CONFLICTS = [
  {
    issue: 'None',
    detail: 'Option B logically extends W5 principle: "If Math.floor is the target, exclude all non-Math.floor patterns"',
    severity: '✅ CONSISTENT',
    explanation: `
      W5 rationale: chart-range.js uses "* 1000", not Math.floor → exclude
      Option B logic: records.js:25 uses "* 1000", not Math.floor → exclude too

      Treatment is uniform. Principle is clear: "Target Math.floor(ms/1000) pattern, not all time operations."`,
  },
];

for (const item of OPTION_B_CONFLICTS) {
  console.log(`${item.severity} ${item.issue}`);
  console.log(`${item.detail}`);
  console.log(`${item.explanation}`);
  console.log('');
}

// ============================================================================
// STAGE 5: Summary Verdict
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 FINAL VERDICT');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('Option A — Convert 3 sec→ms sites:');
console.log('  ❌ Creates logical conflict with W5 decision');
console.log('  ❌ Undefined boundary: "Why this adapter but not that?"');
console.log('  ❌ Deviates from Phase Goal (targets non-Math.floor sites)');
console.log('  ⚠️  Would require reconsidering W5 decision OR adding new justification');
console.log('');

console.log('Option B — Narrow SC2 wording:');
console.log('  ✅ Logically consistent with W5 decision');
console.log('  ✅ Clear principle: "Target Math.floor(ms/1000) pattern only"');
console.log('  ✅ Honors Phase Goal explicitly');
console.log('  ✅ Zero conflicts with existing decisions');
console.log('');

console.log('RECOMMENDATION:');
console.log('  🎯 Choose Option B');
console.log('');
console.log('Why:');
console.log('  1. Your prior W5 decision was sound (chart-range.js is an adapter, not a confusion target)');
console.log('  2. Option A breaks that logic by treating some adapters different from others without principle');
console.log('  3. Option B validates your W5 thinking: "If adapters are safe to exclude, exclude them all"');
console.log('  4. Cleaner outcome: 0 conflicts, clear scope boundary, simpler to explain');
console.log('');
