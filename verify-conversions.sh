#!/bin/bash
# TDD: Verify grep finds all Math.floor(ms/1000) conversions
# Expected: 10 production sites (not test files, not timestamp.ts:27 internal)

echo "🔍 Verifying Math.floor conversion sites..."
echo ""

# Define expected production sites
declare -a EXPECTED=(
    "src/lib/db.ts:51"
    "src/lib/db.ts:89"
    "src/lib/db.ts:124"
    "src/lib/binance.ts:17"
    "src/routes/klines.ts:21"
    "src/routes/klines.ts:22"
    "public/js/charts.js:95"
    "public/js/charts.js:96"
    "public/js/datetime.js:42"
    "public/js/records.js:124"
)

# Sanctioned exception (internal to Timestamp class implementation)
SANCTIONED="src/lib/timestamp.ts:27"

echo "✅ Expected production sites (10):"
for site in "${EXPECTED[@]}"; do
    echo "   $site"
done
echo ""
echo "🔔 Sanctioned exception (1):"
echo "   $SANCTIONED"
echo ""

# Test different grep patterns
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PATTERN 1: Current (broken) — [^)]*/ 1000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "rg \"Math\.floor\([^)]*/ 1000\)\" src public/js --type ts --type js -n"
echo ""
rg "Math\.floor\([^)]*/ 1000\)" src public/js --type ts --type js -n 2>/dev/null | grep -v "\.test\."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PATTERN 2: Broader — Math\.floor\(.*/ 1000\)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "rg \"Math\.floor\(.*/ 1000\)\" src public/js --type ts --type js -n"
echo ""
rg "Math\.floor\(.*/ 1000\)" src public/js --type ts --type js -n 2>/dev/null | grep -v "\.test\."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PATTERN 3: Math\.floor only (catch all)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "rg \"Math\.floor\" src public/js --type ts --type js -n (excluding test)"
echo ""
echo "Production code (should be 10 + 1 sanctioned):"
rg "Math\.floor" src public/js --type ts --type js -n 2>/dev/null | grep -v "\.test\."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BREAKDOWN:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backend (Math.floor on Date.now or numeric division):"
rg "Math\.floor\(Date\.now|Math\.floor\([^)]*startMs|Math\.floor\(raw\[0\]" src --type ts -n 2>/dev/null
echo ""

echo "Frontend (Math.floor on Date.now or Date.UTC):"
rg "Math\.floor\(Date\.now|Math\.floor\(Date\.UTC" public/js --type js -n 2>/dev/null | grep -v "\.test\."
echo ""

echo "Test files (should be 2 in timestamp.test.ts):"
rg "Math\.floor" src --type ts -n 2>/dev/null | grep "\.test\."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TEST RESULT:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PROD_COUNT=$(rg "Math\.floor" src public/js --type ts --type js -n 2>/dev/null | grep -v "\.test\." | wc -l)
echo "Production Math.floor sites found: $PROD_COUNT"
echo "Expected: 11 (10 conversions + 1 sanctioned exception at timestamp.ts:27)"
echo ""
if [ "$PROD_COUNT" -eq 11 ]; then
    echo "✅ PASS: Correct count"
else
    echo "❌ FAIL: Expected 11, got $PROD_COUNT"
fi
