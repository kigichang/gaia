#!/usr/bin/env node
/**
 * GitHub Pages 是純靜態主機，沒有 SPA rewrite 規則：直接開啟
 * https://gaia.kigi.tw/compare 會找不到檔案而回 404。
 *
 * Pages 在找不到路徑時會回傳站台根目錄的 404.html，所以把 index.html
 * 複製一份成 404.html，React Router 就能接手處理深層連結。
 */
import { copyFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

await access(join(DIST, "index.html"));
await copyFile(join(DIST, "index.html"), join(DIST, "404.html"));
console.log("postbuild: 已產生 dist/404.html（SPA 深層連結 fallback）");

// CNAME 與 .nojekyll 放在 public/，vite build 會自動複製到 dist/，這裡只做確認
for (const file of ["CNAME", ".nojekyll"]) {
  try {
    await access(join(DIST, file));
  } catch {
    console.error(`postbuild: 缺少 dist/${file}——請確認 public/${file} 存在`);
    process.exit(1);
  }
}
console.log("postbuild: CNAME 與 .nojekyll 確認無誤");
