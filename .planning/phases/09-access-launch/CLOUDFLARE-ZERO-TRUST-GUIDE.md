# Cloudflare Zero Trust Access 配置指南

**最後更新**: 2026-08-31  
**域名**: `btcethdivergence.bryanlab.cc`

---

## 1. 核心概念

### 基本原則
- **默認拒絕** — 所有請求默認被阻止，必須通過認證才能訪問
- **路徑在 Application 層** — 不同路由需要不同認證方式 → 創建多個 Application

### 三個 Application（不同認證方式）

| # | 名稱 | 路徑 | 認證 | 用途 |
|---|------|------|------|------|
| 1 | Frontend UI | `/`, `/charts.html`, `/calculator.html` | Email OTP | 網頁界面 |
| 2 | Data APIs | `/api/records*`, `/api/klines*` | Email OTP | 數據接口 |
| 3 | Admin APIs | `/api/admin*` | Service Token | 自動化（cron） |

---

## 2. Phase 1: 創建 Service Token

### 步驟

1. Cloudflare Dashboard → Zero Trust → Manage → Service Tokens
2. 點 **Create Token**
3. **Name**: `btcethdivergence-cron-2026-08`（標記年月）
4. **Session Duration**: **1 year**
5. 複製 **Client ID** 和 **Client Secret**，保存到密鑰管理器（1Password、Keychain）

### 重要事項

- ⚠️ **不要** commit 到 git
- ⚠️ **不要** 保存到紙本或文字檔
- ✅ 每 1 year 輪換一次（過期前創建新 token）

---

## 3. Phase 2: 創建 3 個 Application

### Application 1: Frontend UI

1. Zero Trust → Applications → Create an application → Self-hosted
2. **Application name**: `Frontend UI`
3. **Domain**: `btcethdivergence.bryanlab.cc`
4. **Path**: `/` (注：不同路徑需要不同 Application，所以這裡只配 `/` 和靜態頁面)
   - `/`
   - `/charts.html`
   - `/calculator.html`
5. **保存** → 進入 Application

#### 添加 Policy

1. **Policy name**: `Owner Email OTP`
2. **Selector** → 選 **Emails**
3. **Value**: `gn01968711@gmail.com`
4. **Action**: Allow
5. **Session Duration**: 1 month
6. **保存**

### Application 2: Data APIs

1. 重複上面的步驟（Create new application）
2. **Application name**: `Data APIs`
3. **Path**: 
   - `/api/records*`
   - `/api/klines*`
4. **Policy name**: `Owner Email OTP`
5. **Selector**: Emails
6. **Value**: `gn01968711@gmail.com`
7. **Action**: Allow
8. **Session Duration**: 1 month

### Application 3: Admin APIs

1. **Application name**: `Admin APIs`
2. **Path**: `/api/admin*`
3. **Policy name**: `Service Token Auth`
4. **Selector** → 選 **Service Token**（不是 Email！）
5. **Service Token**: 選你在 Phase 1 創建的 token（`btcethdivergence-cron-2026-08`）
6. **Action**: Allow
7. **Session Duration**: 1 month

---

## 4. 配置 Local 和 CI

### Local: 更新 launchd Runner

編輯 `~/.config/btcethdivergence/backfill-runner.sh`：

```bash
export CF_CLIENT_ID="<你的 Client ID>"
export CF_CLIENT_SECRET="<你的 Client Secret>"
export WORKER_URL="https://btcethdivergence.bryanlab.cc"
export INGEST_TOKEN="<你的 INGEST_TOKEN>"
```

### GitHub Actions: 添加密鑰

1. GitHub Repo Settings → Secrets and variables → Actions
2. 添加：
   - `CF_CLIENT_ID`
   - `CF_CLIENT_SECRET`

### 測試

```bash
curl -H "Cf-Access-Client-Id: $CF_CLIENT_ID" \
     -H "Cf-Access-Client-Secret: $CF_CLIENT_SECRET" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
```

期望結果：`200` 或 `{"ok":true,"data":{...}}`

---

## 5. Duration 說明（簡明版）

### Service Token Duration = 1 year
- Service Token 本身的有效期
- 1 year 後 token 失效，cron 停止工作
- **行動**：每 1 year 輪換一次

### Policy Session Duration = 1 month
- 用戶登入後多久需要重新認證
- 對 cron 影響不大（每次請求都獨立認證）
- 可以設得比 Token Duration 短

### 它們互不影響
✅ Service Token 可以 1 year，Policy 可以 1 month — **不需要一致**

---

## 6. Token 輪換（1 year 後）

### 執行步驟

1. **創建新 token**（重複 Phase 1，名稱改成新年月）
2. **更新 local 配置** — 改 `~/.config/btcethdivergence/backfill-runner.sh`
3. **更新 GitHub Actions 密鑰** — 改 `CF_CLIENT_ID` 和 `CF_CLIENT_SECRET`
4. **測試新 token** — 運行上面的 curl 命令確認
5. **刪除舊 token** — Cloudflare Dashboard → Service Tokens → 找舊 token → 刪除

### 緊急撤銷（Token 洩露）

1. Cloudflare Dashboard → Service Tokens
2. 找到該 token → 點 **Revoke**
3. 立即創建新 token，更新配置

---

## 7. 常見問題

### Q: 為什麼要 3 個 Application？
A: 不同認證方式（Email OTP vs Service Token）需要分開。一個 Application 只能有一種認證。

### Q: Session Duration 1 month 是上限嗎？
A: 是的。Cloudflare 允許的最長 session 是 1 month。

### Q: Service Token Duration 可以比 Policy Session 更長嗎？
A: **是的**。它們互不影響。Token Duration = token 何時失效，Policy Duration = 每次認證的會話時長。

### Q: Cron 會被 Policy Session 打斷嗎？
A: **不會**。Cron 每次請求都是獨立認證，Policy Duration 不影響下一次請求。

---

## 8. 配置檢查清單

### Phase 1: Service Token
- [ ] 創建 token，名稱帶年月（例 `btcethdivergence-cron-2026-08`）
- [ ] Session Duration = 1 year
- [ ] 複製 Client ID + Secret
- [ ] 保存到密鑰管理器

### Phase 2: Application 1 (Frontend UI)
- [ ] 名稱: `Frontend UI`
- [ ] 域名: `btcethdivergence.bryanlab.cc`
- [ ] 路徑: `/`, `/charts.html`, `/calculator.html`
- [ ] Policy: Owner Email OTP
- [ ] Email: `gn01968711@gmail.com`
- [ ] Session Duration: 1 month
- [ ] 保存

### Phase 2: Application 2 (Data APIs)
- [ ] 名稱: `Data APIs`
- [ ] 路徑: `/api/records*`, `/api/klines*`
- [ ] Policy: Owner Email OTP
- [ ] Session Duration: 1 month
- [ ] 保存

### Phase 2: Application 3 (Admin APIs)
- [ ] 名稱: `Admin APIs`
- [ ] 路徑: `/api/admin*`
- [ ] Policy: Service Token Auth
- [ ] 選擇 Service Token: `btcethdivergence-cron-2026-08`
- [ ] Session Duration: 1 month
- [ ] 保存

### Phase 3: Local 和 CI 配置
- [ ] 更新 `~/.config/btcethdivergence/backfill-runner.sh`
- [ ] 更新 GitHub Actions 密鑰
- [ ] 測試 curl 命令，確認 200 OK

---

## 9. 驗證

### 測試 Frontend UI
1. 訪問 `https://btcethdivergence.bryanlab.cc/`
2. 被重定向到 Email OTP 登入頁面
3. 輸入 `gn01968711@gmail.com`
4. 收到 OTP，輸入 OTP
5. 登入成功，看到主頁

### 測試 Data APIs
```bash
curl https://btcethdivergence.bryanlab.cc/api/records
# 被 Cloudflare 要求認證（重定向到 OTP 頁面）
```

### 測試 Admin APIs (Service Token)
```bash
curl -H "Cf-Access-Client-Id: $CF_CLIENT_ID" \
     -H "Cf-Access-Client-Secret: $CF_CLIENT_SECRET" \
     https://btcethdivergence.bryanlab.cc/api/admin/backfill-cursor
# 期望: 200 OK
```

---

**完成所有步驟後，app 完全被 Access 保護。**
