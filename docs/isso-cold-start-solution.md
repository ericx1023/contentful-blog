# Isso 冷啟動解決方案

## 問題描述

Render 免費服務在 15 分鐘無活動後會進入休眠狀態。當用戶首次訪問頁面時，Isso 服務器需要 30-60 秒才能喚醒，導致評論無法立即顯示。

## 解決方案

我們實現了以下優化來處理 Render 冷啟動問題：

### 1. 自動喚醒機制 (`_app.page.tsx`)

應用啟動時會自動：
- 🔄 Ping Isso 服務器來喚醒它
- ⏱️ 設置 30 秒超時
- 🔁 如果失敗，5 秒後自動重試
- 💬 顯示「正在喚醒評論服務器...」的友好提示

### 2. 智能載入策略

- **延遲載入腳本**：只有在服務器響應後才載入 Isso 腳本
- **錯誤處理**：如果服務器無法訪問，顯示友好的錯誤訊息
- **一鍵重新載入**：用戶可以點擊按鈕重新嘗試

### 3. 改進的用戶體驗

**載入中狀態**：
```
┌─────────────────────────────┐
│ 🔄 正在喚醒評論服務器...      │
└─────────────────────────────┘
```

**錯誤狀態**（如果載入失敗）：
```
┌─────────────────────────────────────────┐
│ ⚠️ 評論系統暫時無法使用                    │
│                                          │
│ Render 免費服務在閒置後會進入休眠狀態。   │
│ 伺服器可能正在啟動中（需要 30-60 秒）。   │
│                                          │
│ [ 🔄 重新載入頁面 ]                       │
│                                          │
│ ▼ 技術細節                                │
└─────────────────────────────────────────┘
```

## 測試工具

我們提供了一個測試腳本來檢查 Isso 服務器狀態：

```bash
# 測試 Isso 服務器是否可訪問
node scripts/test-isso-server.js
```

### 輸出示例

**服務器正常運行**：
```
✅ Embed Script (embed.min.js) - OK (200) - 450ms
✅ Main Endpoint - Status: 400 - 150ms
🎉 SUCCESS: Isso server is running and accessible!
```

**服務器冷啟動中**：
```
✅ Embed Script (embed.min.js) - OK (200) - 21427ms
⚠️  Main Endpoint - Status: 400 - 316ms
⚠️  PARTIAL: Some endpoints are responding, but not all.
💡 The server might still be starting up. Try again in 10-20 seconds.
```

**服務器無法訪問**：
```
❌ Embed Script (embed.min.js) - Failed - 30000ms
❌ Main Endpoint - Failed - 30000ms
❌ FAILED: Isso server is not responding.
```

## 使用流程

### 開發環境

1. **首次啟動應用**：
   ```bash
   yarn dev
   ```

2. **檢查服務器狀態**（可選）：
   ```bash
   node scripts/test-isso-server.js
   ```

3. **訪問網站**：
   - 第一次可能需要等待 30-60 秒
   - 螢幕右下角會顯示「正在喚醒評論服務器...」
   - 服務器喚醒後，評論會自動載入

4. **如果評論無法載入**：
   - 查看瀏覽器 Console 的錯誤訊息
   - 點擊「重新載入頁面」按鈕
   - 或等待 1 分鐘後手動刷新

### 生產環境

部署到 Vercel/Netlify 後，用戶體驗相同：
- 首次訪問可能需要等待冷啟動
- 系統會自動處理並顯示友好提示
- 後續訪問（15 分鐘內）會立即載入

## Console 訊息說明

### 成功載入
```
🔄 Pinging Isso server to wake it up...
✅ Isso server is awake and responding
✅ Isso script loaded successfully via Next.js Script
✅ Initializing Isso for new thread
```

### 冷啟動中
```
🔄 Pinging Isso server to wake it up...
⏱️ Isso server wake-up timeout (30s) - server might be cold starting
🔄 Retrying Isso server wake-up in 5 seconds...
✅ Isso server is awake and responding
✅ Isso script loaded successfully
```

### 載入失敗
```
❌ Failed to ping Isso server
❌ Isso failed to initialize after 30 retries
📝 Possible reasons:
  1. Isso server is cold starting (Render free tier)
  2. Isso server is down or unreachable
  3. Network connectivity issues
  4. CORS configuration problem
💡 Try refreshing the page in 30-60 seconds
```

## 性能指標

- **服務器喚醒時間**：20-60 秒（首次）
- **後續載入時間**：< 1 秒
- **重試次數**：最多 30 次（3 秒）
- **用戶等待超時**：30 秒

## Render 免費服務限制

- ⏰ **休眠時間**：15 分鐘無活動
- 🚀 **喚醒時間**：30-60 秒
- 💾 **儲存空間**：512 MB RAM
- 🌐 **月流量**：100 GB

## 升級建議

如果你需要更快的響應時間，可以考慮：

1. **Render 付費方案**（$7/月）
   - 不會休眠
   - 更多資源
   - 更好的性能

2. **其他託管方案**
   - DigitalOcean App Platform
   - Railway
   - Fly.io

3. **使用其他評論系統**
   - Disqus（免費但有廣告）
   - Utterances（基於 GitHub Issues）
   - Giscus（基於 GitHub Discussions）

## 故障排除

### 問題 1：評論一直顯示「正在喚醒服務器...」

**解決方案**：
1. 檢查 `.env.local` 中的 `NEXT_PUBLIC_ISSO_URL`
2. 運行測試腳本確認服務器可訪問
3. 檢查 Render dashboard 確認服務運行中

### 問題 2：顯示錯誤訊息但服務器正常

**解決方案**：
1. 清除瀏覽器緩存
2. 檢查 CSP 設置（`config/headers.js`）
3. 確認 Isso 服務器的 CORS 設置

### 問題 3：本地開發可以但生產環境失敗

**解決方案**：
1. 確認環境變數在部署平台設置正確
2. 檢查 Isso 服務器的 `isso.conf` 中的 `host` 設置
3. 確認生產域名在 Isso 允許列表中

## 相關文件

- `src/pages/_app.page.tsx` - 自動喚醒邏輯
- `src/components/shared/Comments.tsx` - 評論組件
- `config/headers.js` - CSP 設置
- `scripts/test-isso-server.js` - 測試工具





