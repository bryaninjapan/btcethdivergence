# Phase 3: Historical Load & Cron Sync — Learning & Issues

**Date Discovered**: 2026-09-01  
**Issue Type**: Post-deployment bug in launchd configuration  
**Severity**: HIGH (Production data sync stopped)  
**Root Cause**: Configuration inconsistency between BTCUSDT and ETHUSDT launchd jobs

---

## 問題描述

### 症狀
- ETHUSDT K 線數據停止更新 (Aug 31, 18:00)
- BTCUSDT K 線數據正常更新至 Aug 31, 23:00
- launchd 狀態碼 1 (錯誤) vs 狀態碼 0 (正常)

### 根本原因
Phase 3 實現的 launchd-based cron 任務在 ETHUSDT 配置中有**不一致的 WORKER_URL**：

| Symbol | File | WORKER_URL | Status |
|--------|------|-----------|--------|
| BTCUSDT | backfill-runner.sh | `https://btcethdivergence.bryanlab.cc` | ✅ 正確 |
| ETHUSDT | backfill-runner-eth.sh | `https://btcethdivergence.gn01968711.workers.dev` | ❌ 過時域名 |

### 發生時間軸
- **Aug 31, 03:15** — Phase 3 初始化，兩個 launchd 任務創建
- **Aug 31, 18:00** — ETHUSDT cronjob 執行，但連接到過時的 `.workers.dev` 域名
- **API 返回 404** — 無法讀取 cursor，backfill 失敗
- **Aug 31, 23:00** — BTCUSDT 正常更新（使用正確的 `bryanlab.cc`）
- **Sep 01, 05:00** — 問題被發現並修復

---

## 診斷過程 (TDD)

### Test 1: 排除 Phase 10 Timestamp 轉換問題
```bash
# TDD 驗證 Timestamp.fromMillis() 是否會拒絕 ETHUSDT 數據
# 結果: ✅ 正常工作，不是根本原因
```

### Test 2: 排除數據庫約束問題
```bash
# 查詢生產 D1 資料庫
SELECT COUNT(*) FROM klines WHERE symbol='ETHUSDT'
# 結果: 49613 (停止在特定時間)
```

### Test 3: 發現 Backfill 日誌錯誤
```bash
# 檢查 launchd 日誌
cat ~/.config/btcethdivergence/backfill-eth.log
# 結果: "Failed to read cursor: HTTP 404"
```

### Test 4: 比較 WORKER_URL 配置
```bash
grep WORKER_URL ~/.config/btcethdivergence/backfill-runner*.sh
# 結果: 發現 ETHUSDT 使用過時域名
```

### Test 5: 驗證修復方案
```bash
# 更新 WORKER_URL + CF Access Token
# 手動運行 backfill
# 結果: ✅ 成功插入 26 條新記錄
```

---

## 修復方案

### Root Cause: 過時的 Workers Domain
Phase 3 創建 launchd 任務時，ETHUSDT 的腳本被設置為使用：
```
https://btcethdivergence.gn01968711.workers.dev
```

但實際的生產 Worker 域名是：
```
https://btcethdivergence.bryanlab.cc
```

### 修復步驟
1. 更新 `~/.config/btcethdivergence/backfill-runner-eth.sh`:
   ```bash
   export WORKER_URL="https://btcethdivergence.bryanlab.cc"
   export CF_CLIENT_ID="2d8605d82a8f20d60898c2f9268f85c5.access"
   export CF_CLIENT_SECRET="cfast_GlNHFwuenhx0rqydDajBjZVodsm0DHUxHh3svySy611f7ccf"
   ```

2. 重新加載 launchd:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist
   launchctl load ~/Library/LaunchAgents/com.btcethdivergence.backfill-eth.plist
   ```

3. 驗證:
   ```bash
   launchctl list | grep btcethdivergence
   # 結果: 兩個都是狀態碼 0 ✅
   ```

### 修復後結果
- ✅ ETHUSDT 成功更新 26 條新記錄
- ✅ Cursor 從 1788112800 → 1788206400
- ✅ launchd 狀態碼 1 → 0
- ✅ 每天 18:00 自動執行 backfill

---

## launchd 狀態碼說明

| 狀態碼 | 含義 | 原因 |
|--------|------|------|
| 0 | ✅ 正常 | 上次執行成功，job 加載正常 |
| 1 | ❌ 錯誤 | 上次執行失敗，缓存舊狀態 |

**解決方式**: 重新卸載/加載 plist 文件清除狀態碼。

---

## 關鍵學習

### 1. 配置一致性檢查清單
- ✅ 相同服務的多個 launchd job 應共享 WORKER_URL
- ✅ 定期審核 launchd 配置與實際服務 URL 的一致性
- ✅ 避免在不同腳本中硬編碼不同的 URL

### 2. launchd 狀態碼管理
- 狀態碼 1 並**不自動清除**，需要重新加載
- 修復腳本後必須重新加載 plist 才能更新狀態
- 建議定期檢查: `launchctl list | grep <service>`

### 3. Cloudflare Access Service Token 必需
- Phase 9 添加 Cloudflare Access 後，backfill API 需要 Service Token
- ETHUSDT 腳本缺少 CF_CLIENT_ID 和 CF_CLIENT_SECRET
- 應在 Phase 3 完成後的 Phase 9 中一併更新

### 4. 故障排查流程
1. **檢查日誌**: `~/.config/btcethdivergence/backfill-*.log`
2. **測試 API**: `curl -w "%{http_code}" <WORKER_URL>/api/admin/backfill-cursor`
3. **驗證環境變數**: `env | grep WORKER_URL`
4. **重新加載 launchd**: `launchctl unload/load`
5. **驗證狀態**: `launchctl list`

---

## 與其他 Phase 的關聯

### Phase 9 Impact
當 Phase 9 添加 Cloudflare Access 後：
- ✅ BTCUSDT 腳本也添加了 CF Token
- ❌ ETHUSDT 腳本遺漏了 CF Token
- 應在 Phase 9 中檢查並更新所有相關腳本

### Phase 10 Impact (Initial Suspicion, False)
- 最初懷疑是 Phase 10 Timestamp 轉換問題
- TDD 驗證後排除
- 實際上是完全獨立的 Phase 3 配置問題

---

## 預防措施

### 1. 腳本同步檢查
```bash
# 定期檢查兩個腳本的 WORKER_URL 是否一致
diff <(grep WORKER_URL ~/.config/btcethdivergence/backfill-runner.sh) \
     <(grep WORKER_URL ~/.config/btcethdivergence/backfill-runner-eth.sh)
```

### 2. launchd 健康檢查
```bash
# 定期檢查 launchd 狀態
launchctl list | grep btcethdivergence
```

### 3. 文檔化
每個 launchd job 都應該有清晰的文檔說明：
- ✅ 執行時間
- ✅ 使用的 WORKER_URL
- ✅ 所需的環境變數
- ✅ 依賴的服務版本

---

## 結論

**Phase 3 實現成功**，但在后续 Phase (特别是 Phase 9) 中引入的變化沒有同步到所有相關的 launchd 腳本。

這是一個**配置管理問題**，而非程序邏輯問題。

**建議**: 在後續的 Phase 維護中，建立配置檢查清單，確保相同服務的所有副本保持同步。

---

*Phase 3 LEARNING 記錄於 2026-09-01*
