import { copyFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * maplibre-gl 在自己已打包好的程式碼裡用
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 動態組出 worker 檔案路徑，
 * 預期這個檔案跟自己被載入的那個 chunk 檔案放在同一個目錄。
 *
 * Vite/Rolldown 的 worker 靜態分析只認得原始碼裡字面寫出的
 * `new Worker(new URL('...', import.meta.url))`，maplibre-gl 這段是在相依套件
 * 已經打包好的程式碼裡動態組字串，建置工具看不懂，所以這個檔案不會被自動複製進 dist/。
 *
 * 後果：vector 類型的來源（例如 OpenFreeMap Liberty 底圖）需要 worker 解析 .pbf 圖磚，
 * worker 檔案 404 之後圖磚永遠解析不出來，且不會拋出任何 map error 事件——
 * 畫面只會停在 style 的 background 圖層顏色，是純靜態站上非常容易忽略的一種空白。
 * raster 圖磚（NLSC 底圖）與 maplibre-contour 的等高線／地形（用自己內嵌的
 * Blob URL worker）都不受影響，所以只有切到向量底圖才會出現這個症狀。
 *
 * `maplibre-gl-worker.mjs` 自己又用靜態 `import ... from "./maplibre-gl-shared.mjs"`
 * 引入第二個檔案，所以兩個檔案都要複製，缺一樣還是會炸（worker script 直接
 * 載入失敗，因為它自己的 import 解析不到）。用 `require.resolve` 而不是寫死
 * node_modules 路徑，才不怕套件管理工具改變安裝結構。
 */
function copyMaplibreWorkerPlugin(): Plugin {
  const require = createRequire(import.meta.url);
  const filesToCopy = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "copy-maplibre-gl-worker",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    closeBundle() {
      const distDir = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
      const absOutDir = isAbsolute(outDir) ? outDir : join(root, outDir);
      // Vite 預設 assetsDir 是 "assets"，跟我們的 maplibre chunk 同目錄，
      // worker 內部用 import.meta.url 組出的相對路徑才能解析到這些檔案。
      for (const file of filesToCopy) {
        const src = join(distDir, file);
        if (!existsSync(src)) {
          throw new Error(`找不到 ${file}：${src}（maplibre-gl 套件結構可能已變更）`);
        }
        copyFileSync(src, join(absOutDir, "assets", file));
      }
    },
  };
}

export default defineConfig({
  // 自訂網域 gaia.kigi.tw 是從根路徑供應，所以 base 必須是 '/'。
  // 不要改成 '/gaia/' —— 那是沒有自訂網域時的 project page 路徑。
  base: "/",
  plugins: [react(), copyMaplibreWorkerPlugin()],
  optimizeDeps: {
    // Vite 的 dep 預打包會漏掉 maplibre-gl 的 worker（maplibre-gl-worker.mjs 永遠 pending），
    // 結果是 dev 模式下地圖一張圖磚都不會載入、而且不報錯。排除它讓 Vite 直接用原始 ESM。
    exclude: ["maplibre-gl"],
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Vite 8（Rolldown）用 codeSplitting.groups 取代舊的 manualChunks 物件形式。
        // 把地圖與圖表引擎各自拆出來，瀏覽器可以平行下載也比較好快取。
        codeSplitting: {
          groups: [
            { name: "maplibre", test: /node_modules[\\/]maplibre-/ },
            { name: "charts", test: /node_modules[\\/](recharts|d3-|victory-)/ },
          ],
        },
      },
    },
  },
});
