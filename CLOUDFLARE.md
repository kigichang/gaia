# CLOUDFLARE.md — 搬遷到 Cloudflare 的評估與計畫

> 本文件是 2026-08 完成的搬遷評估定稿，供日後實際搬遷時參考。
> 所有限額與價格皆於 **2026-08-14～15 以官方文件查證**；免費方案的額度會變，
> 動手前把「查證過的數字」小節重新核對一輪。

## 目標與結論

三個需求：(1) 免費空間、(2) 自建 OSM 圖磚（不大量使用官方/第三方資源）、
(3) 開放大眾使用，流量要撐得住。

**定案：**

| 部分 | 去處 | 理由 |
|---|---|---|
| 網站本體（5.5 MB） | **Cloudflare Pages（免費）** | 頻寬與請求數無上限；GitHub Actions 用 wrangler 部署 |
| 自建 OSM 圖磚 | **PMTiles 放 Cloudflare R2（免費）**，綁 `tiles.gaia.kigi.tw` 直連 | egress 免費、支援 Range request、Protomaps 官方首選 |
| `kigi.tw` DNS | **zone 搬進 Cloudflare（免費）** | R2 綁自訂網域的硬性前提（見下） |
| 世界底圖樣式 | **`@protomaps/basemaps`**（Protomaps schema） | 與 Protomaps 圖磚 schema 一致；OpenFreeMap 降為備援 |
| NLSC WMTS / AWS DEM | **維持現狀** | 政府服務與 AWS Open Data，不是要避開的 OSM 官方資源 |

這是唯一一組「純靜態、免金鑰、頻寬撐得住公開流量、放得下數百 MB 圖磚檔」
全部同時成立的免費組合。整站「無後端、無 API key」的架構約束不變——
wrangler 的 Cloudflare API token 只存在 GitHub Actions 的 repo secret，
前端拿到的只是公開網址。

**選 PMTiles 的隱性好處**：儲存層隨時可以整包搬走（S3／Scaleway／B2 都支援
Range request），前端只改一個網址，不被單一供應商綁死。

---

## 為什麼要搬（GitHub Pages 的兩道牆）

- **單檔限制**：git push 擋 100 MiB 以上的檔案——數百 MB 的 PMTiles 進不了
  Pages repo（LFS 有自己的頻寬計費，不划算）。
- **頻寬**：100 GB/月軟限制。向量圖磚一次瀏覽約抓 15–30 MB，
  100 GB 只撐約 3,000–6,000 次造訪/月，公開站不夠用。

（Protomaps 官方確實把 GitHub Pages 列為可行的 PMTiles 主機——但前提是檔案
塞得進 1 GB repo 且流量小；本案兩個條件都過不了。）

## 免費方案評估（對照組為什麼出局）

| 方案 | 判定 | 關鍵數字（2026-08 查證） |
|---|---|---|
| Cloudflare Pages 免費 | ✅ 放網站本體 | 頻寬/請求**無上限**；⚠️ 單檔 25 MiB、20,000 檔、建置 500 次/月 |
| Cloudflare R2 免費 | ✅ 放圖磚 | 儲存 10 GB、Class B 讀取 1,000 萬次/月、**egress 全免**；超量 Class B $0.36/百萬次 |
| GitHub Pages | 網站可、圖磚不可 | 站台 1 GB、頻寬 100 GB/月（軟）、git 單檔 100 MiB |
| Netlify 免費 | ❌ | 2025-09 起改點數制，實際只夠約 15 GB/月頻寬 |
| Vercel Hobby | ❌ | 100 GB/月且明文限個人非商業用途 |
| OpenFreeMap 自架 | ❌ | 需要一台 300 GB 磁碟的專用伺服器（€4.5/月起），不是靜態空間 |

---

## 圖磚自建做法（已查證可行）

### 格式與前端接法

- 格式用 **PMTiles**：單一大檔、靠 HTTP Range request 讀取，不需要 tile server。
- 前端：npm 套件 `pmtiles`，`addProtocol("pmtiles", protocol.tile)` 一行接上
  maplibre（MapLibre 官方有 maplibre-gl 6.3 + pmtiles 3.2 的範例）。
  ⚠️ `addProtocol` 整個 app 生命週期只能呼叫一次——比照 `demSource.ts`
  單例的既有慣例。
- ⚠️ 新增依賴後要重新確認 `optimizeDeps` 與 worker 複製那兩個 maplibre 陷阱
  沒有被波及（CLAUDE.md「已知的版本陷阱」）。

### 資料來源與體積

- **Protomaps 每日 planet build** 免費下載（maps.protomaps.com/builds），
  用 `pmtiles extract` 切子集（`--bbox` / `--region` / `--maxzoom`）：
  - 世界 z0–8：約 200 MB（實測 z0–6 僅 46 MB，每加一級約翻倍）
  - 臺灣 z0–15：Geofabrik 臺灣 pbf 為 310 MB，extract 量級估數百 MB
  - 合計 < 1 GB，R2 免費 10 GB 綽綽有餘
- 自產替代路（不建議先走）：Planetiler `--area=taiwan --output=taiwan.pmtiles`，
  臺灣分鐘級可產、RAM 約 1 GB 即可；但「全世界」要處理 73 GB 的 planet pbf，
  免費路線划不來。

### ⚠️ 三個查證中發現的坑

1. **Schema 不相容**：Protomaps 圖磚是自家 schema，**不是** OpenFreeMap
   Liberty 期望的 OpenMapTiles schema。用 Protomaps extract 就必須換
   `@protomaps/basemaps` 樣式（BSD 授權，light/dark 等 flavor）；想保留
   Liberty 外觀就得自己用 Planetiler 的 openmaptiles profile 產圖磚。
   **定案是換 Protomaps 樣式，OpenFreeMap 降為備援**（`basemaps.ts` 的
   備援機制既有，方向對調）。
2. **單一 PMTiles 檔要壓在 512 MB 以下**：Cloudflare 可快取單檔上限
   Free/Pro/Business 都是 512 MB，超過就每個 range 請求都回源 R2。
   所以**拆成世界檔＋臺灣檔**，不要併成一個大檔。
3. **glyphs/sprites 要一起自架**：從 `protomaps/basemaps-assets` 下載放進
   Pages，順便解掉目前借用 OpenFreeMap glyph 端點的外部依賴。
   ⚠️ 字型名稱會變（不再是 `"Noto Sans Bold"`），而 `text-font` 是全站已知
   脆弱點——換完要照 CLAUDE.md「沿線標註很脆弱」的流程，用
   `queryRenderedFeatures` 重數每一層的標註數，不能只看建置成功。

### R2 設定要點

- **綁自訂網域必須把 zone 放進 Cloudflare**（partial/CNAME setup 也算），
  這是 R2 與 Pages 的差異：Pages 的 subdomain 可以只在外部 DNS 加 CNAME，
  R2 不行。這就是 DNS 搬家的原因。
- ⚠️ `r2.dev` 公開網址官方明文「rate-limited、僅供開發」，不能當正式端點。
- CORS 要 expose `etag` / `range` / `if-match`（Protomaps 文件的建議清單）。
- 快取：R2 自訂網域預設只快取特定副檔名，`.pmtiles` 要加 Cache Rule
  （Cache Everything + 長 TTL）才進 CDN cache。
- ⚠️ 保守假設**每個 range 讀取都計一次 Class B**（cache 命中是否計數官方
  未明載，社群回報不一）；免費 1,000 萬次/月照這個最保守假設估算即可。

---

## 流量估算（免費方案）

- 向量圖磚一次造訪約 300–600 個 range 請求、15–30 MB。
- egress 不計量 → 流量費永遠是 0。
- 唯一計量器是 R2 Class B：免費 1,000 萬次/月 ≈ **2–3 萬次造訪/月**
  （最保守、不計快取分攤）。一個班 30 人天天用約佔免費額度 5%。
- 超量後 $0.36/百萬次 → **每多 10 萬次造訪約 $11–18/月**，實際有 CDN
  快取命中分攤會更低。
- 條款面：2023 年改版後的 Service-Specific Terms **明文允許**透過
  Developer Platform（含 R2）供應大型檔案——圖磚走 R2 在免費方案完全合規。

## Cloudflare Pro（$20/月）要不要買

**結論：Pro 不會提高任何流量上限——能撐的流量與免費方案一模一樣。
它買到的是更高的安全性（WAF 與 bot 防護），不是容量。一開始不用買。**

### 為什麼 Pro 不改變流量上限

Pro 是「網域（zone）層級」的方案，跟 Workers／R2／Pages 的額度是**分開計費
的兩套系統**。這套架構的流量由三個計量器決定，官方文件逐項確認過都與
zone plan 無關：

| 計量器 | Free | Pro | 誰能改變它 |
|---|---|---|---|
| CDN 頻寬（egress） | 不計量 | 不計量 | 沒有差別——兩個方案都無限 |
| R2 讀取（Class B） | 1,000 萬次/月免費，超量 $0.36/百萬次 | **完全相同** | 只有 R2 自己的用量計費 |
| Pages 單檔 25 MiB／Workers 10 萬請求/日 | — | **完全相同** | 只有 Workers Paid（$5/月）能解 Workers 上限 |

可快取單檔 512 MB 上限 Free 與 Pro 也相同（放寬只有 Enterprise）。
條款面在免費方案就已合規（R2 供應大檔明文允許），不存在「付費才安全」的
條款差異。所以「能支撐多少流量」的答案 Free 和 Pro 是同一個：
**每月約 2–3 萬次造訪內免費，之後每多 10 萬次造訪約 $11–18/月的 R2 超量**
——這條成本曲線 Pro 一毛都不省。

### Pro 實際買到什麼

**對本案有用的（都是安全性，不是容量）：**

- **WAF managed rulesets**（Cloudflare Managed＋OWASP Core）＋ **20 條自訂
  規則** ＋ **Super Bot Fight Mode**（可設定動作、bot analytics、可加例外；
  Free 的 Bot Fight Mode 不可調整）——站紅了以後防爬蟲、防有人寫腳本整包抓
  圖磚燒 Class B 額度。這是 Pro 對本案唯一有實質意義的東西，性質是保險。
- Cache Analytics（保留 7 天）——看快取命中率，調參用。

**對本案沒用的：**

- Cache Rules 10→25 條、Edge TTL 下限 2h→1h——本案用不到 10 條規則，
  圖磚 TTL 本來就設長。
- Pages 建置 500→5,000 次/月——每 6 小時的水庫 cron 一個月約 120 次，
  Free 的 500 次綽綽有餘。
- Polish 圖片壓縮——本站幾乎沒有圖片資產（Mirage 已於 2025-09 除役）。

### 如果要花錢，這樣花更有效

| 花費 | 買到什麼 | 對本案 |
|---|---|---|
| **$0（先上線量測）** | R2 免費額度＋不計量 CDN | ✅ 起點。dashboard 看 Class B 用量再決定 |
| **R2 超量（自動）** | $0.36/百萬次讀取 | ✅ 流量成長的自然路徑，每月幾美元級 |
| **Workers Paid $5/月** | 1,000 萬請求/月、移除 10 萬/日上限 | 只有哪天想改走 Worker 代理（標準 z/x/y 網址）才需要 |
| Pro $20/月 | WAF／bot 防護＋Cache Analytics | 發現濫用流量再買（擋掉濫用比付超量划算），隨時可開，架構不用動 |
| Argo（$5/月起＋$0.10/GB） | 智慧路由降延遲 | ❌ 按 GB 計費，跟免費 egress 的優勢對沖 |
| Cache Reserve | 持久快取層 | ❌ 官方明文**不支援 origin Range request**，與 PMTiles 的存取模式直接不相容 |

**花錢的正確順序**：先免費上線 → dashboard 盯 R2 Class B 用量一兩個月 →
流量正常成長就讓 R2 超量自然吸收 → 發現異常爬蟲流量或月讀取逼近千萬次，
第一筆錢花在 Pro 的 bot 防護。**Pro 對遷移工作的影響是零**：Free 和 Pro 的
架構、設定步驟、DNS 配置完全相同，Pro 是 zone 上隨時可升降的開關，
遷移設計不需要為它預留任何東西。

## 替代路線（評估過、知道為什麼不走）

### Worker 代理（Protomaps 官方 serverless worker）

Worker 綁 R2 bucket，對外提供 `/{z}/{x}/{y}.mvt` 端點＋Cache API 快取。
三個查證後的否決理由：

1. 免費 Workers **10 萬請求/日，且 cache 命中照樣計數**（官方明文同價計費）
   → 一天只撐約 170–330 次造訪，撞頂整站圖磚 429。
2. **躲不掉 DNS 搬家**：官方明文 Cache API 只在自訂網域生效，workers.dev
   上快取無效——「不搬 zone」的想像好處不存在。
3. workers.dev 在中國大陸被封鎖、部分校園/ISP 有解析失敗回報。

哪天真的需要標準 z/x/y 網址（例如給不能跑 pmtiles protocol 的第三方用），
買 **Workers Paid $5/月**（1,000 萬請求/月、移除每日上限）就能走這條路。

### 其他 S3 相容儲存（PMTiles 不用改，只換網址）

| 服務 | 免費額度（2026-08） | 瓶頸 |
|---|---|---|
| Backblaze B2 | 儲存 10 GB 永久免費；egress 免費額度＝儲存量 3 倍/月 | 直連只有 ~3 GB/月；**前置 Cloudflare 才真正免 egress**（Bandwidth Alliance 仍有效）——又需要 Cloudflare zone，繞回原點 |
| Tigris | 5 GB 儲存、egress 免費 | Class B 只有 10 萬次/**月**（R2 的 1%），≈166–333 次造訪/月 |
| Supabase | 1 GB 儲存＋10 GB 頻寬/月 | 兩個額度都貼天花板 |
| Scaleway | 儲存 €0.016/GB/月；egress 前 75 GB/月免費 | 「近乎免費」（本案 ~€0.02/月）；不依賴 Cloudflare 是唯一獨特優點 |
| AWS S3 | egress 前 100 GB/月永久免費；儲存/請求照表計費 | 「近乎免費」（本案每月幾分美元）；要開帳號綁卡 |
| Storj | 免費方案 2024 已廢止 | 出局 |

**備援定位**：不想依賴 Cloudflare 時，真正可用的是 AWS S3 或 Scaleway；
B2 只有搭配 Cloudflare 時才成立。

---

## 遷移步驟

### 階段一：網站本體 → Cloudflare Pages

1. Cloudflare 開帳號、建 Pages 專案（direct upload 模式，不接 git 整合——
   建置流程留在 GitHub Actions，`build:reservoirs` 的 cron 與
   `continue-on-error` 行為都不動）。
2. `.github/workflows/deploy.yml`：`upload-pages-artifact`＋`deploy-pages`
   換成 `wrangler pages deploy dist`；`CLOUDFLARE_API_TOKEN`／
   `CLOUDFLARE_ACCOUNT_ID` 進 repo secrets。
3. Pages 專案 dashboard 走完「Add a custom domain」加 `gaia.kigi.tw`
   （⚠️ 不先做這步、只改 DNS 會 522）。
4. cyberdns.tw 的 CNAME：`gaia.kigi.tw` 從 `kigichang.github.io.` 改指
   `<project>.pages.dev.`（subdomain 接 Pages 不需要搬 zone，此時 DNS
   還不用動）。
5. `public/CNAME` 對 Pages 無作用但留著無害；`postbuild.mjs` 的 404.html
   照舊（Pages 對 SPA 的處理：找不到路徑會回 404.html，行為與 GitHub Pages
   相同；上線後重驗深層連結）。
6. GitHub Pages 保留一段時間當回退——確認 Cloudflare 側穩定前，
   repo 的 Pages 設定不要關。

### 階段二：DNS zone 搬進 Cloudflare

1. Cloudflare 加 `kigi.tw` zone（Free plan），讓它掃描並核對現有記錄
   ——⚠️ 逐筆對照 cyberdns.tw 現況（含 MX、TXT、其他子網域），漏一筆就是
   信收不到或別的服務斷線。
2. 到註冊商把 NS 換成 Cloudflare 給的兩台。註冊商不變、可逆。
3. 生效後 `dig +short gaia.kigi.tw` 應照常解析；`gaia.kigi.tw` 的 CNAME
   在 Cloudflare 裡維持指向 pages.dev。

### 階段三：圖磚上線

1. 產圖磚（本機或 CI 皆可）：
   ```bash
   # pmtiles CLI 從 protomaps/go-pmtiles 的 GitHub Releases 下載
   pmtiles extract https://build.protomaps.com/<最新日期>.pmtiles world-z8.pmtiles --maxzoom=8
   pmtiles extract https://build.protomaps.com/<最新日期>.pmtiles taiwan.pmtiles \
     --bbox=118.0,21.5,122.3,26.5
   # ⚠️ 兩檔各自確認 < 512 MB（CDN 可快取上限）
   ```
2. 建 R2 bucket → 上傳兩檔 → 綁自訂網域 `tiles.gaia.kigi.tw` →
   設 CORS（expose `etag`/`range`/`if-match`）→ 加 Cache Rule
   （`.pmtiles` Cache Everything＋長 TTL）。
3. 前端：加 `pmtiles` 依賴（版本鎖定，比照技術棧慣例）、`basemaps.ts` 新增
   Protomaps 樣式（`@protomaps/basemaps` 的 `layers()`＋`namedFlavor()`）、
   glyphs/sprites 指向自架路徑、OpenFreeMap 改為備援。
4. GitHub Actions 加一支**每月**的圖磚更新 workflow（重跑 extract →
   `wrangler r2 object put`）。⚠️ 比照 `build:reservoirs` 的哲學：上游掛掉
   時沿用舊圖磚，不要讓失敗擋住部署。

### 驗證清單（遷移特有，其餘照 CLAUDE.md 既有清單）

- [ ] `curl -I https://gaia.kigi.tw` → 200＋HTTPS；深層連結 `/compare` 回
      app shell（狀態碼仍可能是 404，行為比照 GitHub Pages 時代）
- [ ] `curl -sI -H "Range: bytes=0-99" https://tiles.gaia.kigi.tw/taiwan.pmtiles`
      → **206**（不是 200 全檔）＋CORS header
- [ ] 同一 range 請求打兩次，第二次 `cf-cache-status: HIT`
- [ ] 瀏覽器切到 Protomaps 世界底圖後 `queryRenderedFeatures()` 有東西
      （⚠️ 這一步等同 CLAUDE.md 檢查清單第 7 項——向量底圖一定要實測渲染，
      建置成功與 typecheck 過抓不到 worker/樣式問題）
- [ ] 每一層沿線標註用 `queryRenderedFeatures` 重數（字型換了）
- [ ] DevTools Network：無任何帶 API key 的請求；無對 OpenFreeMap 的請求
      （除非備援被觸發）
- [ ] 水庫 cron 部署照常每 6 小時跑、`reservoirs-live.json` 有更新
- [ ] Cloudflare dashboard：R2 Class B 用量曲線與造訪量對得上
      （這是日後判斷「要不要花錢」的唯一儀表）

---

## 查證過的數字（動手前重新核對這一節）

以下皆為 2026-08-14～15 官方文件現值；標「軟」者為 fair-use 性質。

| 項目 | 數值 |
|---|---|
| Cloudflare Pages 免費 | 頻寬/請求無上限；單檔 25 MiB；20,000 檔；建置 500 次/月 |
| Cloudflare R2 免費 | 儲存 10 GB-月；Class A 100 萬、Class B 1,000 萬次/月；egress 免費 |
| R2 超量 | 儲存 $0.015/GB-月；Class A $4.50、Class B $0.36/百萬次 |
| CDN 可快取單檔 | Free/Pro/Business 512 MB；Enterprise 5 GB |
| Workers 免費 | 10 萬請求/日（cache 命中也計）；CPU 10 ms |
| Workers Paid | $5/月：1,000 萬請求/月、移除每日上限；超量 $0.30/百萬 |
| Pro | $20/月（年繳）；WAF managed rules、Super Bot Fight Mode、Cache Rules 25 條、Cache Analytics 7 天 |
| GitHub Pages | 站台 1 GB；頻寬 100 GB/月（軟）；git 單檔 100 MiB |
| Protomaps planet build | z0–15 約 107–120 GB；每日更新、免費下載、勸阻 hotlink |
| 世界 extract | z0–6 約 46 MB；z0–8 推算約 200 MB（每加一級約翻倍） |
| Geofabrik 臺灣 pbf | 310 MB（2026-08-13） |

主要出處：developers.cloudflare.com（pages/platform/limits、r2/pricing、
workers/platform/pricing、cache/concepts/default-cache-behavior、
cache/advanced-configuration/cache-reserve）、cloudflare.com/plans、
cloudflare.com/service-specific-terms-application-services、
docs.protomaps.com（pmtiles/cloud-storage、basemaps/downloads、
deploy/cloudflare、pmtiles/maplibre）、download.geofabrik.de、
docs.github.com（pages 限額）、netlify.com/pricing、vercel.com/docs/limits。
