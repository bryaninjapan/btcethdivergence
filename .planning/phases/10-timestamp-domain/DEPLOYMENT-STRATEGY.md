# Phase 10 部署策略 — 漸進式部署 + 回滾保障

## 概述
安全的三階段部署，包含監控和快速回滾能力。

---

## 部署階段

### 階段 1️⃣：準備 (Pre-Deployment)
**目標**: 確保回滾基礎設施就位

- [ ] 備份當前生產版本的 commit hash
- [ ] 驗證當前生產環境的 API 響應正常
- [ ] 記錄部署前的關鍵指標

**備份命令**:
```bash
# 記錄當前生產版本
git log --oneline -1 > /tmp/prod-version-backup.txt

# 當前版本: 顯示最後一個 commit
git rev-parse HEAD
```

**預期結果**: 
- ✅ 當前穩定版本已記錄
- ✅ 回滾點已標記

---

### 階段 2️⃣：金絲雀部署 (Canary Deployment)
**目標**: 在生產環境中測試新代碼，但僅對少量流量

**選項 A: 使用 Cloudflare 路由進行流量分割**

```toml
# wrangler.jsonc 支援多個 routes
"routes": [
  {
    "pattern": "btcethdivergence.bryanlab.cc/*",
    "zone_name": "bryanlab.cc",
    # 可以添加 zone_id 進行精確控制
  }
]
```

**部署步驟**:

1. **部署新版本到獨立環境**:
   ```bash
   # 發布到 staging/canary 環境（如果可用）
   wrangler deploy --env canary
   ```

2. **測試 Canary 版本**:
   ```bash
   # 使用特定 URL 測試（如 canary.btcethdivergence.bryanlab.cc）
   curl https://canary.btcethdivergence.bryanlab.cc/api/klines?symbol=BTCUSDT&start=1234567890&end=1234567891
   ```

3. **監控 Canary 指標** (30 分鐘):
   - ✅ API 響應時間 (目標: < 100ms)
   - ✅ 錯誤率 (目標: 0%)
   - ✅ Timestamp 轉換邏輯正確
   - ✅ 數據庫查詢成功

4. **綠燈檢查清單**:
   - [ ] Canary 環境所有 API 端點返回 200/正常
   - [ ] 沒有新的錯誤日誌
   - [ ] Timestamp 轉換輸出正確 (秒轉毫秒轉換)
   - [ ] 負數時間戳守衛正常工作 (返回 400)

**預期結果**:
- ✅ 新代碼在隔離環境中運作正常
- ✅ 已驗證 Phase 10 邏輯（Timestamp）
- ✅ 安全回滾點已創建

---

### 階段 3️⃣：完全部署到生產 (Full Production Deployment)

**部署命令**:
```bash
# 部署到生產環境
wrangler deploy

# 驗證部署成功
curl -i https://btcethdivergence.bryanlab.cc/
```

**部署後驗證** (5-10 分鐘):

1. **API 端點檢查**:
   ```bash
   # 測試 K 線 API
   curl "https://btcethdivergence.bryanlab.cc/api/klines?symbol=BTCUSDT&start=$(date +%s000)&end=$(($(date +%s)*1000))"
   
   # 預期: 返回 200 + 數據 (或 200 + 空數據組，無錯誤)
   ```

2. **記錄端點響應**:
   - ✅ /api/klines 返回 200
   - ✅ /api/records 返回 200
   - ✅ /charts.html 加載正常
   - ✅ Timestamp.js 加載成功 (304 Not Modified)

3. **Timestamp 邏輯驗證**:
   ```bash
   # 驗證 API 日誌顯示 Timestamp 轉換運作
   # 檢查 Cloudflare Workers 日誌是否有錯誤
   wrangler tail
   ```

---

## 快速回滾計畫

### 回滾觸發條件 ⚠️

回滾當出現以下任何情況：

1. **API 返回 5xx 錯誤** (> 5% 錯誤率)
2. **資料庫查詢失敗** (Timestamp 轉換錯誤)
3. **Timestamp 邏輯返回錯誤值** (e.g., 負數、無效秒數)
4. **前端 Timestamp.js 加載失敗** (404 或無效 JavaScript)
5. **新增 console.error 日誌** 顯示異常

### 回滾步驟 (< 2 分鐘)

**方案 A: 使用 Git 回滾 (最安全)**

```bash
# 1. 查看版本歷史
git log --oneline -10

# 2. 確認上一個穩定版本 (e.g., 6ef4a31 = Phase 9)
git log --oneline | grep -i "phase 9"

# 3. 回滾到上一個版本
git revert -n HEAD

# 4. 重新部署
wrangler deploy

# 5. 驗證回滾成功
curl https://btcethdivergence.bryanlab.cc/api/klines?symbol=BTCUSDT&start=1234567890&end=1234567891
```

**方案 B: 使用 Cloudflare 版本控制 (如果配置)**

```bash
# 列出部署歷史
wrangler deployments list

# 回滾到之前的版本
wrangler rollback
```

**驗證回滾**:
- ✅ 部署成功 (wrangler 返回成功訊息)
- ✅ API 返回 200
- ✅ 沒有 Timestamp 相關錯誤
- ✅ 生產服務恢復正常

---

## 部署時間表

| 時間 | 活動 | 所有者 | 預期時長 |
|------|------|-------|---------|
| T+0min | ✅ 準備階段 (備份) | 部署者 | 5 min |
| T+5min | 🟡 金絲雀部署 (Staging) | 部署者 | 30 min |
| T+35min | 📊 監控 Canary 結果 | 部署者 | 10 min |
| T+45min | 🟢 生產部署 | 部署者 | 5 min |
| T+50min | ✔️ 驗證生產 | 部署者 | 10 min |
| T+60min | 📋 部署完成 (無回滾需要) | 部署者 | - |

**如果發生問題**:
| 時間 | 活動 | 預期時長 |
|------|------|---------|
| T+50-70min | 🚨 偵測問題 | 5 min |
| T+70-75min | 🔄 執行回滾 | 2 min |
| T+75-85min | ✔️ 驗證回滾成功 | 10 min |

---

## 成功標準

✅ **部署成功**:
- 所有 API 端點返回預期的狀態碼
- 沒有新的錯誤日誌
- Timestamp 邏輯正確運作
- K 線圖正常加載並顯示數據

❌ **部署失敗**:
- API 返回 5xx 錯誤
- Timestamp 轉換返回無效值
- 資料庫查詢失敗
- 前端資源加載失敗

---

## 檢查清單

### 部署前
- [ ] Phase 10 所有測試通過 (36+8)
- [ ] 代碼審查完成 (0 HIGH/CRITICAL)
- [ ] LEARNING.md 已記錄所有決策
- [ ] 當前生產版本已備份

### 部署中
- [ ] Canary 環境測試完成
- [ ] 所有監控指標正常
- [ ] 沒有新的 console.error

### 部署後
- [ ] 生產 API 響應正常
- [ ] Timestamp 轉換運作正確
- [ ] 沒有回滾需要
- [ ] 部署時間 < 1 小時

---

## 聯絡人 & 緊急程序

如果部署出現問題：
1. 停止繼續操作
2. 檢查 Cloudflare Workers 日誌
3. 執行回滾步驟
4. 驗證舊版本恢復

預計總回滾時間: **< 5 分鐘**

---

*此策略保證 Phase 10 部署安全且可控制，任何問題都可快速復原。*
