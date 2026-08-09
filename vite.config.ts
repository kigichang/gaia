import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 自訂網域 gaia.kigi.tw 是從根路徑供應，所以 base 必須是 '/'。
  // 不要改成 '/gaia/' —— 那是沒有自訂網域時的 project page 路徑。
  base: "/",
  plugins: [react()],
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
