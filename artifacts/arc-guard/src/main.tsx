import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML = `
    <div dir="rtl" style="min-height:100vh;background:#0b1929;color:#e2edf8;font-family:Vazirmatn,Inter,sans-serif;
      display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px">
      <div style="font-size:48px">⚠️</div>
      <h1 style="font-size:20px;color:#f87171;margin:0">خطای بحرانی</h1>
      <p style="font-size:15px;color:#94a3b8;margin:0">عنصر root یافت نشد. صفحه را بازنشانی کنید.</p>
      <button onclick="location.reload()" style="padding:12px 28px;background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.4);border-radius:12px;color:#38bdf8;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit">
        🔄 بازنشانی
      </button>
    </div>`;
} else {
  // Global uncaught error handler — last resort to avoid white screen
  window.addEventListener("error", (e) => {
    console.error("[global] Uncaught error:", e.error ?? e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[global] Unhandled promise rejection:", e.reason);
  });

  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
