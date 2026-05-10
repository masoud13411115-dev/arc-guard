import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const basePath = process.env.BASE_PATH;
if (!basePath) throw new Error("BASE_PATH environment variable is required but was not provided.");

const isProd = process.env.NODE_ENV === "production";

// ── Inject Replit Secrets into browser bundle ──────────────────────────────
// Vite in dev mode gives its own import.meta.env handling priority over
// the define block, so we use a custom global __ARC_GUARD_CONFIG__ that
// Vite has no special handling for — guaranteed to reach the browser.
const g = (k: string) => process.env[k] ?? "";
const arcGuardConfig = {
  apiKey:            g("VITE_ARC_GUARD_API_KEY"),
  authDomain:        g("VITE_ARC_GUARD_AUTH_DOMAIN"),
  projectId:         g("VITE_ARC_GUARD_PROJECT_ID"),
  storageBucket:     g("VITE_ARC_GUARD_STORAGE_BUCKET"),
  messagingSenderId: g("VITE_ARC_GUARD_MESSAGING_SENDER_ID"),
  appId:             g("VITE_ARC_GUARD_APP_ID"),
  measurementId:     g("VITE_ARC_GUARD_MEASUREMENT_ID"),
};
// Debug log (no secret values are printed — only presence)
for (const [k, v] of Object.entries(arcGuardConfig)) {
  console.log(`[arc-guard env] ${k}: ${v ? "✓ set" : "✗ missing"}`);
}
const envDefine = {
  __ARC_GUARD_CONFIG__: JSON.stringify(arcGuardConfig),
};

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        injectionPoint: "self.__WB_MANIFEST",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      devOptions: { enabled: false },

      manifest: {
        name: "ARC Guard — سیستم گشت امنیتی",
        short_name: "ARC Guard",
        description: "سیستم هوشمند گشت و نگهبانی با QR Code و GPS — پلتفرم SaaS امنیتی",
        theme_color: "#0c1829",
        background_color: "#0c1829",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        orientation: "portrait-primary",
        scope: basePath,
        start_url: basePath + "?source=pwa",
        id: basePath,
        lang: "fa",
        dir: "rtl",
        categories: ["security", "business", "productivity"],
        prefer_related_applications: false,
        icons: [
          { src: "icon-72.png",          sizes: "72x72",   type: "image/png" },
          { src: "icon-96.png",          sizes: "96x96",   type: "image/png" },
          { src: "icon-128.png",         sizes: "128x128", type: "image/png" },
          { src: "icon-144.png",         sizes: "144x144", type: "image/png" },
          { src: "icon-152.png",         sizes: "152x152", type: "image/png" },
          { src: "icon-192.png",         sizes: "192x192", type: "image/png" },
          { src: "icon-384.png",         sizes: "384x384", type: "image/png" },
          { src: "icon-512.png",         sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "داشبورد مدیر",
            short_name: "داشبورد",
            description: "ورود به داشبورد مدیریت و مانیتور نگهبانان",
            url: basePath + "?role=manager",
            icons: [{ src: "icon-96.png", sizes: "96x96" }],
          },
          {
            name: "شروع گشت",
            short_name: "گشت",
            description: "ورود نگهبان و شروع گشت امنیتی",
            url: basePath + "?role=guard",
            icons: [{ src: "icon-96.png", sizes: "96x96" }],
          },
        ],
        screenshots: [
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow",
            label: "ARC Guard داشبورد امنیتی",
          },
        ],
        related_applications: [
          {
            platform: "play",
            url: "https://play.google.com/store/apps/details?id=com.arcguard.security",
            id: "com.arcguard.security",
          },
        ],
      },
    }),

    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Target modern browsers — allows smaller output, no polyfills
    target: "esnext",
    // Source maps in production for error tracking
    sourcemap: isProd ? "hidden" : true,
    // Warn on chunks > 600 KB (before gzip)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor bundles so users only re-download what changed
        manualChunks: {
          // React core (rarely changes)
          "vendor-react": ["react", "react-dom"],
          // Firebase — split auth vs firestore (guards need both, but loaded async)
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          // QR scanner — only loaded when scanning (dynamic import in GuardPatrol)
          // Note: html5-qrcode is already dynamically imported via import()
          // Maps
          "vendor-maps": ["leaflet"],
          // Charts + UI
          "vendor-ui": ["@tanstack/react-query", "lucide-react"],
        },
      },
    },
  },

  define: envDefine,

  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
