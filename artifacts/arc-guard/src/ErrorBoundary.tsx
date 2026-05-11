import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] React render error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const msg = error.message ?? String(error);
    const isFirebaseError = /firebase|firestore|indexeddb|quota|permission/i.test(msg);
    const isNetworkError = /network|fetch|offline|cors/i.test(msg);

    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "#0b1929",
          color: "#e2edf8",
          fontFamily: "Vazirmatn, Inter, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          gap: "20px",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(239,68,68,0.15)",
          border: "2px solid rgba(239,68,68,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          ⚠️
        </div>

        {/* Title */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f87171", margin: "0 0 8px" }}>
            خطا در بارگذاری برنامه
          </h1>
          <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7, margin: 0 }}>
            {isFirebaseError
              ? "خطا در اتصال به پایگاه داده. اگر در حالت Private استفاده می‌کنید، مرورگر را عادی باز کنید."
              : isNetworkError
              ? "خطای شبکه — اتصال اینترنت را بررسی کنید و دوباره تلاش نمایید."
              : "خطای غیرمنتظره‌ای رخ داد. لطفاً صفحه را بازنشانی کنید."}
          </p>
        </div>

        {/* Error detail */}
        <div style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "12px 16px",
          maxWidth: 380,
          width: "100%",
          direction: "ltr",
          textAlign: "left",
        }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px", fontFamily: "monospace" }}>
            {error.name}
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.5 }}>
            {msg.length > 200 ? msg.slice(0, 200) + "…" : msg}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleReload}
            style={{
              padding: "12px 28px",
              background: "rgba(14,165,233,0.15)",
              border: "1px solid rgba(14,165,233,0.4)",
              borderRadius: 12,
              color: "#38bdf8",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🔄 بازنشانی صفحه
          </button>
          <button
            onClick={this.handleClear}
            style={{
              padding: "12px 20px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              color: "#f87171",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            پاک‌سازی حافظه
          </button>
        </div>

        <p style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
          ARC Guard — در صورت تکرار مشکل، با پشتیبانی تماس بگیرید
        </p>
      </div>
    );
  }
}
