# Feature Research

**Domain:** Personal crypto trading analysis tool (divergence tracking + charting + leverage calculator)
**Researched:** 2026-08-30
**Confidence:** MEDIUM (general market landscape from trading-journal / correlation-tool / position-calculator products is well-established via web search — LOW-confidence source tier per classify-confidence; project-specific requirements are HIGH confidence, sourced directly from PROJECT.md and PLAN.md which the owner has already locked in)

## Context Note

This is **not** a competitive product being launched to a market — it's a single-user, password-gated internal tool. "Table stakes" here means "the owner will stop using it if this is missing," not "users will churn." "Differentiators" means "this is the actual reason the tool is worth building instead of using existing SaaS." Because scope is already tightly defined in PROJECT.md (explicit Out of Scope list), most of the anti-feature work below is about **confirming those decisions were right** and flagging a few additional traps that weren't yet mentioned.

The domain research draws on three adjacent product categories, since no single existing product does exactly this:
1. **Crypto trading journals** (TradesViz, Altrady, UltraTrader, TradeReview, SuperTrader) — for the record-keeping feature set.
2. **Correlation/divergence indicators** (TradingView correlation scripts, SMT divergence indicators, TrendSpider) — for the divergence-analysis feature set.
3. **Leverage/position-size calculators** (Binance/Bybit-oriented calculator sites) — for the calculator feature set.

## Feature Landscape

### Table Stakes (Users Expect These)

Features the owner will notice immediately if missing — core to the stated Core Value ("讓使用者能快速記錄、回顧和分析 BTC 與 ETH 之間的價格背離事件").

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create/edit/delete divergence records (start/end time, type, notes, tags) | Every trading journal product treats trade/event logging as the baseline primitive — without it there's nothing to analyze | LOW | Already fully specified in PLAN.md CRUD API |
| Tags + free-text notes on each record | Universal across TradesViz, Altrady, UltraTrader — tagging is how traders find patterns later ("show me all bearish btc-lead events") | LOW | Comma-separated tags per PLAN.md schema is sufficient for single-user scale (~dozens to low hundreds of records) |
| Filter/search records by type and tag | A growing log without filtering becomes unusable after ~50 entries; all journal tools support this | LOW | Already in PLAN.md (`GET /api/records?type=&tag=`) |
| Candlestick chart of the underlying asset(s) tied to a logged event | Every trading journal and every correlation tool pairs the log entry with the price chart — a record without a visual is not verifiable later | MEDIUM | Lightweight Charts is the correct choice; this is non-negotiable for a divergence tool since "divergence" is inherently a visual/comparative concept |
| Two synchronized/comparable price series (BTC + ETH) viewable together | This is the entire premise of SMT/correlation divergence tools — comparing two correlated assets side by side is the core mechanic, not a nice-to-have | MEDIUM | Stacked layout (not overlay) is a valid simplification vs. industry norm (many tools overlay or use ratio charts) — acceptable tradeoff for solo use, already decided |
| Deep-link from record → chart at that time range | TradesViz/Altrady all support "click trade → see chart at that moment"; without it the log and the chart are two disconnected tools | LOW | Already specified (`?start=&end=` with padding) |
| Historical price data coverage matching the trading history being reviewed (2021→present) | A divergence tracker with gaps in history can't be used to review real past events | MEDIUM | Backfill + daily cron already planned; this is infrastructure, not UI, but its absence breaks the whole tool |
| Position size / P&L / risk-reward calculator | Every serious leverage trader uses one before entering a trade; virtually all competing calculator sites (positionsizecalculator.xyz, cryptoriskcalc.com, etc.) treat margin+leverage+SL+TP → R:R as the standard output set | LOW | Formula already specified in PLAN.md and matches industry-standard position-size-calculator formulas |
| Long/short direction toggle in calculator | Every calculator surveyed (Binance/Bybit-style tools) supports both directions — a long-only calculator is only half-useful | LOW | Already specified |
| Basic auth/privacy gate | Not a "feature" competitors advertise, but for a tool storing personal trading behavior it's assumed baseline | LOW | Cloudflare Access — already decided, zero custom auth code needed |

### Differentiators (Why Build This Instead of Using Existing Tools)

These aren't required to make the tool "not broken," but they're the actual reasons a custom tool beats TradingView + a spreadsheet + a generic calculator site.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Purpose-built divergence taxonomy (`time_lag` / `structural` / `opposite`) | Generic journal tools use free-form tags for this; a fixed enum with dedicated filter makes multi-year pattern analysis ("how often does `structural` divergence precede a reversal?") much faster than tag-mining | LOW | Already the design — this is the single most domain-specific decision in the project and should be preserved, not genericized |
| Time-synced dual chart (scroll/zoom one → moves both) | Correlation/SMT tools on TradingView require manual symbol-switching or cramped multi-pane setups; a purpose-built synced two-pane view removes the friction of comparing candle-by-candle | MEDIUM | This is the feature that most directly serves "quickly record, review, analyze" — worth the extra implementation effort even though it's harder than a static chart |
| Record ↔ chart round-trip built specifically around divergence events (not generic "trade entries") | Existing journals link a chart to a *trade*, not to a *cross-asset divergence window* with a start and end time; that's a different mental model this tool is purpose-built for | LOW (incremental over table-stakes deep-link) | This is really the reframing of a standard feature (deep link) around the actual unit of analysis (a divergence window, not a trade) |
| Log-scale toggle on long-lookback charts | Not universal on retail calculator/journal tools, but valuable given the ~5.5 year history (2021→2026) spans multiple order-of-magnitude price regimes for both assets | LOW | Cheap to add (Lightweight Charts has built-in log-scale support), meaningfully improves usability over that timespan |
| Owner-defined dropdown time entry (no manual date typing) | Off-the-shelf trade-journal UIs typically use native datetime pickers or manual entry, which is slower and error-prone for a workflow of "go back and log a 2022 event" | LOW | Small UX choice, but explicitly requested and genuinely reduces the friction that would otherwise cause the owner to stop logging accurately |

### Anti-Features (Commonly Requested, Often Problematic)

These are patterns other tools in this space commonly build that would be actively harmful to add here. Several are already correctly excluded in PROJECT.md's "Out of Scope" — restated here with the domain rationale for why that exclusion is correct, plus a few additional ones not yet mentioned.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Automated divergence detection (algorithmic SMT/correlation signal generation) | SMT divergence indicators (TrendSpider, TradingView scripts) do this automatically and it looks like "the real product" | Automated divergence detection is genuinely hard to tune (false positives on noisy 1h data), and the owner's stated goal is to build *personal judgment* through manual review — automating it defeats the stated Core Value | Manual logging (already the correct MVP decision in PROJECT.md) |
| Overlay/ratio chart (BTC/ETH ratio single-pane) | Standard technique in correlation-analysis tools — a single ratio line "shows divergence at a glance" | Compresses two candlestick series into one line, losing the OHLC detail the owner explicitly wants to eyeball; also non-trivial to implement well (needs its own scale/series math) | Stacked side-by-side candlesticks (already decided) |
| In-chart click-to-populate calculator (click high/low on chart → auto-fills entry/SL/TP) | Feels like the "polished SaaS" version of a calculator | Real implementation cost (crosshair event handling, coordinate-to-price mapping, edge cases for log-scale) for a workflow the owner says is easier by just typing numbers off the chart they're already looking at | Manual price entry (already decided) |
| Multi-timeframe support (4h, daily, weekly aggregation or synthesis) | "More timeframes = more thorough analysis" is the default assumption in every charting tool | Multiplies storage, sync-cron complexity, and UI surface (timeframe selector, resampling logic) for a benefit the owner has explicitly said isn't needed at 1h resolution | 1h only (already decided) |
| Additional trading pairs / multi-asset correlation matrix | Correlation tools (Multi-Asset Correlation Web, etc.) support N-asset comparison as a selling point | This tool's entire value proposition is a *specific, deep* BTC/ETH relationship; generalizing to N pairs turns it into a worse clone of TradingView with none of the focus | Fixed BTCUSDT/ETHUSDT only (already decided) |
| Multi-user / shared accounts / sharing links | Common in "let's make it a product" scope creep | Adds auth complexity (roles, invites, per-user data isolation) with zero benefit — this is explicitly a private single-owner tool | Cloudflare Access single-password gate (already decided) |
| Mobile app (native iOS/Android) | Every trading-journal competitor (UltraTrader, SuperTrader) leads with a mobile app | Massive scope increase (separate codebase or cross-platform framework) for a tool used for periodic desk-based review, not on-the-go trade execution | Responsive web (already decided) |
| Real-time/live price streaming (WebSocket ticker, sub-hourly updates) | Feels expected for "a trading tool" | This is a *retrospective analysis* tool, not an execution/monitoring tool — daily cron sync is sufficient and avoids WebSocket infra, reconnect handling, and Workers duration limits | Daily cron backfill of closed 1h candles (already decided) |
| Alerts/notifications (email, push, webhook on new divergence pattern match) | Correlation-indicator tools commonly ship alerting as a headline feature | Requires an automated detection engine (see above) as a prerequisite, plus notification infra (email/push) — disproportionate for a single user who reviews on their own schedule | None needed; owner drives the review cadence manually |
| P&L / portfolio tracking (linking calculator results to actual executed trades, running win-rate stats) | Trading journals (TradesViz, TradeReview) build extensive analytics/stats dashboards on top of logged trades | This tool logs *divergence observations*, not executed trades — conflating the two would require a second data model (actual positions, fills, exchange sync) that's out of scope per PROJECT.md's Core Value | Keep calculator fully separate and stateless (already decided) |
| Exchange API integration for account balance / auto-import trades | "Auto-import" is a common trading-journal selling point (reduces manual entry) | Requires exchange API keys, credential storage, and security surface area for a private tool where the owner is fine hand-entering ~1-3 records per divergence event | Manual record creation (already decided) |
| Chart annotations/drawing tools (trendlines, Fibonacci, freehand) | TradingView-style charting tools always include drawing tools | Lightweight Charts doesn't natively support rich drawing tools, and building them is a substantial UI project on its own; the owner's actual need is "look at two synced candlestick charts," not "draw on them" | None — if trendline analysis is needed, do it on TradingView directly and just log the conclusion here |

## Feature Dependencies

```
[Kline backfill + daily cron sync]
    └──requires──> [D1 klines table + Binance API client]

[GET /api/klines]
    └──requires──> [Kline backfill + daily cron sync]
                       └──enables──> [Dual candlestick chart page]

[Divergence record CRUD]
    └──requires──> [D1 divergence_records table]
                       └──enables──> [Records table page]
                                         └──enables──> [Record → Chart deep link]
                                                           └──requires──> [Dual candlestick chart page]

[Time-synced scroll/zoom between BTC/ETH charts]
    └──requires──> [Dual candlestick chart page]
    └──enhances──> [Record → Chart deep link] (padding + auto-load only meaningful once sync exists)

[Log-scale toggle]
    └──enhances──> [Dual candlestick chart page]

[Leverage calculator]
    └──independent──> (no dependency on records or charts — pure client-side)

[Cloudflare Access password gate]
    └──wraps──> (all pages — applied last, in Phase 5 per PLAN.md)
```

### Dependency Notes

- **Records page requires record CRUD, which requires the D1 schema:** this is why PLAN.md's Phase 1 (backend foundation) must precede Phase 2 (records UI) — building the UI against a live API from day one avoids mock-data rework.
- **Chart deep-link requires both the records feature and the chart feature to exist:** this is the reason Records (Phase 2) is sequenced before Charts (Phase 3) in PLAN.md — the "view chart" button on a record row has nothing to link to until the chart page exists, but building charts first would mean testing them with hand-typed URL params instead of real records. Either order works technically; PLAN.md's owner-defined order (records first) is fine because charts remain independently testable via `?start=&end=` query params during Phase 3.
- **Calculator has zero dependency on records/charts/backend** — it is correctly sequenced last among the three user-facing features (Phase 4) not because it's low priority but because it's fully decoupled and can slot in anytime; PLAN.md's ordering (Records → Charts → Calculator) matches the owner's stated priority, not a technical constraint.
- **Time-sync and log-scale enhance the base chart rather than gating it:** the chart page is usable (if clunky) without sync; sync is what makes it good. This means if Phase 3 runs short on time, an unsynced fallback is a safe degradation path, not a launch blocker.
- **Cloudflare Access wraps everything and has no feature dependencies** — correctly sequenced last (Phase 5) since it's an infrastructure concern, not a feature that other features build on.

## MVP Definition

### Launch With (v1)

Everything in PROJECT.md's "Active" requirements — this list is already minimum, not padded:

- [ ] Create/edit/delete divergence records (time range, type, notes, tags) — the core logging loop this entire tool exists for
- [ ] Records table with type/tag filtering — without filtering, the log is unreadable past a few dozen entries
- [ ] Dual 1h candlestick charts (BTC + ETH, stacked, time-synced, log-scale toggle) — the visual verification step that makes a logged "divergence" meaningful
- [ ] Record → chart deep link — closes the loop between "I logged this" and "let me look at it again"
- [ ] Dropdown-based time entry — removes the single biggest friction point for a workflow involving typing many historical timestamps
- [ ] Leverage calculator (long/short, margin/entry/SL/TP/leverage → R:R) — a second, independent core use case the owner explicitly wants
- [ ] Binance kline backfill (2021→present) + daily cron sync — infrastructure prerequisite for the chart feature to have any historical data to show
- [ ] Cloudflare Access password gate — non-negotiable given personal trading data is stored

### Add After Validation (v1.x)

Nothing is currently planned to be deferred to v1.x — PROJECT.md's scope is already MVP-sized for a single owner. If gaps emerge after real usage, likely candidates (not yet requested) would be:

- [ ] Export records to CSV — trigger: owner wants to analyze patterns in a spreadsheet or back up data outside D1
- [ ] Basic stats summary (count of records per type, average duration) — trigger: owner starts wanting quick aggregate view instead of scanning the raw table

### Future Consideration (v2+)

Explicitly out of scope per PROJECT.md, revisit only if the tool's purpose changes (e.g., if it were ever opened to other users):

- [ ] Automated divergence detection — defer indefinitely; conflicts with the tool's purpose of building manual judgment (see Anti-Features)
- [ ] Multi-pair support beyond BTC/ETH — defer indefinitely; would dilute focus (see Anti-Features)
- [ ] Mobile app — defer indefinitely; responsive web is sufficient for desk-based review

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Divergence record CRUD | HIGH | LOW | P1 |
| Records table + filters | HIGH | LOW | P1 |
| Kline backfill + cron sync | HIGH | MEDIUM | P1 |
| Dual candlestick chart | HIGH | MEDIUM | P1 |
| Chart time-sync (scroll/zoom) | HIGH | MEDIUM | P1 |
| Record → chart deep link | HIGH | LOW | P1 |
| Dropdown time entry | MEDIUM | LOW | P1 |
| Log-scale toggle | MEDIUM | LOW | P1 |
| Leverage calculator | HIGH | LOW | P1 |
| Cloudflare Access gate | HIGH | LOW | P1 (last phase, but mandatory) |
| CSV export | LOW | LOW | P3 |
| Aggregate stats summary | LOW | MEDIUM | P3 |
| Automated divergence detection | LOW (conflicts with goal) | HIGH | Not planned |
| Multi-pair / correlation matrix | LOW (dilutes focus) | HIGH | Not planned |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

Note: there is no P2 tier in this project — PROJECT.md's Active requirements list maps 1:1 onto P1, which is expected for a correctly-scoped single-user MVP.

## Competitor Feature Analysis

No direct competitor builds "logged divergence events + synced dual chart + leverage calculator" as one integrated tool — the closest comparisons are single-purpose products in adjacent categories.

| Feature | Trading Journals (TradesViz/Altrady/UltraTrader) | Correlation/SMT Indicators (TradingView, TrendSpider) | This Project's Approach |
|---------|----------------------------------------------------|--------------------------------------------------------|--------------------------|
| Event logging | Trade-centric (entry/exit/P&L), tags + notes + screenshots | None — indicator-only, no persistent log | Divergence-window-centric (start/end time + type + notes/tags), no screenshots needed since chart is always re-derivable from stored klines |
| Cross-asset comparison | Not supported — single-asset trade view | Core feature: correlation coefficient, SMT divergence signal, often single-pane overlay/ratio | Two synced full-OHLC panes (BTC/ETH stacked) — richer than a ratio line, simpler than an indicator overlay |
| Divergence classification | Free-form tags only | Binary/ternary signal (bullish/bearish/none divergence) | Fixed 3-type taxonomy (`time_lag`/`structural`/`opposite`) purpose-built for this owner's mental model — a middle ground between free tags and an automated signal |
| Position sizing / risk calc | Sometimes bundled (TradesViz "funding, fees" analytics) but usually a separate tool | Not typically included | Bundled but fully decoupled (no shared state with logging/charting) |
| Automation | Import-focused (auto-import trades from exchange) | Signal-focused (auto-detect divergence, alerting) | Deliberately manual on both fronts — matches the owner's stated goal of building judgment through review, not automation |
| Access model | Multi-user SaaS, subscription | Multi-user SaaS or free script | Single-user, password-gated, self-hosted on Cloudflare |

## Sources

- [TradesViz — cryptocurrency trading journal](https://www.tradesviz.com/cryptocurrency/) — LOW confidence (general web search), used for trading-journal feature baseline
- [Altrady — Crypto Journal features](https://www.altrady.com/features/crypto-journal) — LOW confidence, tags/notes/screenshots pattern
- [UltraTrader — Trading Journal](https://apps.apple.com/us/app/ultratrader-trading-journal/id1615206113) — LOW confidence, tags/mistakes pattern
- [SMT Divergence — TrendSpider Store](https://trendspider.com/trading-tools-store/indicators/696179-smt-divergence/) — LOW confidence, SMT divergence concept and signal dashboard pattern
- [Bitcoin-Ethereum SMT Divergence — Bitsgap blog](https://bitsgap.com/blog/bitcoin-ethereum-smt-divergence-what-is-it-how-to-use-it) — LOW confidence, BTC/ETH-specific divergence framing
- [Multi-Asset Correlation Web — TradingView script](https://www.tradingview.com/script/20aOfrBC-Multi-Asset-Correlation-Web-Abusuhil/) — LOW confidence, correlation heatmap/multi-pair pattern (informs anti-feature rationale)
- [Position Size Calculator (positionsizecalculator.xyz)](https://positionsizecalculator.xyz/) — LOW confidence, standard calculator feature set for Binance/Bybit-style leverage tools
- [CryptoRiskCalc — leverage tool](https://cryptoriskcalc.com/tools/leverage) — LOW confidence, R:R and risk-management calculator feature baseline
- [Project PROJECT.md](file:///Users/bryan/Documents/btcethdivergence/.planning/PROJECT.md) — HIGH confidence, owner-authored scope and Out of Scope decisions
- [Project PLAN.md](file:///Users/bryan/Documents/btcethdivergence/PLAN.md) — HIGH confidence, owner-authored/agreed implementation plan and API contracts

---
*Feature research for: Personal crypto trading divergence analysis tool (BTC/ETH)*
*Researched: 2026-08-30*
