import { cpSync, rmSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const src = path.join(__dirname, "..", "..", "arc-guard", "dist-electron");
const dst = path.join(__dirname, "..", "dist-web");

if (!existsSync(src)) {
  console.error(`[copy-web] Source not found: ${src}`);
  console.error("[copy-web] Run 'pnpm run build:web' first.");
  process.exit(1);
}

rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`[copy-web] Copied ${src} → ${dst}`);
