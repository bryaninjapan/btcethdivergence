# Phase 13b: K-line UI Enhancement

## Goal
Apply TradingView-inspired visual improvements to chart.html:
1. K-line color scheme refinement
2. Add indicator mark visualization
3. Leverage refactored chart state for easy updates

## Depends On
- Phase 13a (Frontend Data Isolation) — Complete ✅

## UI Changes

### Change 1: K-line Colors
**Current**: Default Lightweight Charts colors
**New**: TradingView-style color scheme
- Bullish candle: Bright green (#26a69a)
- Bearish candle: Bright red (#ef5350)
- Wick colors: Match candle direction

**Implementation**:
```javascript
// In createChartState()
const chartOptions = {
  timeScale: { timeVisible: true },
  priceScale: { position: 'right' },
  layout: {
    textColor: '#444',
    backgroundColor: '#fff'
  }
};

series.applyOptions({
  upColor: '#26a69a',
  downColor: '#ef5350',
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350'
});
```

**Effort**: 0.5 day (pure config change)

---

### Change 2: Indicator Marks
**Current**: No visual marks on chart
**New**: Add visual marks for recorded divergence events
- Red dot: Bearish divergence start
- Green dot: Bullish divergence start
- Line: Divergence duration

**Implementation**:
```javascript
// Add to createChartState()
addDivergenceMark(timestamp, type) {
  const color = type === 'bearish' ? '#ef5350' : '#26a69a';
  series.setMarkers([{
    time: timestamp,
    position: 'belowBar',
    color,
    text: '⬇'
  }]);
}
```

**Effort**: 1 day
- Fetch recorded divergences from API
- Calculate mark positions
- Handle multiple marks per chart
- Test integration with time-sync

**Success Criteria**:
- ✅ Marks render correctly on both charts
- ✅ Marks move with time-sync
- ✅ Mark colors match divergence type
- ✅ No performance regression with 100+ marks

---

## Implementation Timeline

| Task | Days | Status |
|------|------|--------|
| K-line color styling | 0.5 | —— |
| Indicator mark logic | 1 | —— |
| Integration testing | 0.5 | —— |
| **Total Phase 13b** | **2 days** | |

---

## Success Criteria

- ✅ K-line colors match TradingView aesthetic
- ✅ Indicator marks render on both charts
- ✅ No performance degradation
- ✅ All 350+ tests still pass
- ✅ E2E verification: charts look correct

---

## Notes

- Phase 13a (refactored chartState) makes these changes trivial
- Can be done without touching core chart logic
- Easy to iterate on colors/marks in future
- Foundation ready for additional TradingView features (indicators, drawings, etc.)

