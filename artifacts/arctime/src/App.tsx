import React, { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";
import { MapPin, QrCode, LogIn, LogOut, ArrowRight, AlertCircle } from "lucide-react";
import ManagerScreen from "./ManagerScreen";

const queryClient = new QueryClient();

// Constants
const COMPANY_ID = "arctime-demo-company";
const BRANCH = { name: "دفتر مرکزی", lat: 36.86079, lng: 30.78304, radiusMeters: 50 };
const VALID_QR_TEXT = "ARCTIME|arctime-demo-company|main-branch";

// Haversine formula
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function nowText() {
  return new Date().toLocaleString("fa-IR");
}

type Screen = "home" | "employee" | "scan" | "manager";

const MANAGER_PASSWORD = "123456";

function AppContent() {
  const [screen, setScreen] = useState<Screen>("home");

  // Manager auth
  const [managerAuthed, setManagerAuthed] = useState(
    () => localStorage.getItem("arctime_manager_auth") === "1"
  );
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const handleManagerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === MANAGER_PASSWORD) {
      localStorage.setItem("arctime_manager_auth", "1");
      setManagerAuthed(true);
      setPwInput("");
      setPwError(false);
      fetchRecords();
    } else {
      setPwError(true);
    }
  };

  const handleManagerLogout = () => {
    localStorage.removeItem("arctime_manager_auth");
    setManagerAuthed(false);
    setScreen("manager");
  };

  // Employee State
  const [employeeName, setEmployeeName] = useState("علی رضایی");
  const [qrText, setQrText] = useState("");
  const [gpsData, setGpsData] = useState<{lat: number, lng: number, accuracy: number} | null>(null);
  const [message, setMessage] = useState<{text: string, type: "success" | "error" | "info"} | null>(null);
  
  // Manager State
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Clear message when screen changes
  useEffect(() => {
    setMessage(null);
  }, [screen]);

  // Get GPS manually
  const getGps = () => {
    if (!navigator.geolocation) {
      setMessage({ text: "مرورگر شما از GPS پشتیبانی نمی‌کند.", type: "error" });
      return;
    }
    setMessage({ text: "در حال دریافت موقعیت مکانی...", type: "info" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsData({
          lat: Number(pos.coords.latitude),
          lng: Number(pos.coords.longitude),
          accuracy: Number(pos.coords.accuracy)
        });
        setMessage({ text: "موقعیت مکانی دریافت شد.", type: "success" });
      },
      (err) => {
        setMessage({ text: "خطا در دریافت موقعیت مکانی. لطفاً دسترسی GPS را بدهید.", type: "error" });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const submitAttendance = async (type: "check_in" | "check_out") => {
    if (!db) {
      setMessage({ text: "لطفاً تنظیمات Firebase را در پنل Secrets انجام دهید.", type: "error" });
      return;
    }
    if (!employeeName.trim()) {
      setMessage({ text: "لطفاً نام خود را وارد کنید.", type: "error" });
      return;
    }
    if (qrText.trim() !== VALID_QR_TEXT) {
      setMessage({ text: "QR معتبر نیست. QR مخصوص شرکت را اسکن کن.", type: "error" });
      return;
    }
    if (!gpsData) {
      setMessage({ text: "لطفاً ابتدا موقعیت مکانی (GPS) خود را دریافت کنید.", type: "error" });
      return;
    }

    const userLat = Number(gpsData.lat);
    const userLng = Number(gpsData.lng);
    const branchLat = Number(BRANCH.lat);
    const branchLng = Number(BRANCH.lng);

    console.log("GPS:", userLat, userLng, "| Branch:", branchLat, branchLng);

    if (!isFinite(userLat) || !isFinite(userLng)) {
      setMessage({ text: "مختصات GPS نامعتبر است. لطفاً دوباره GPS بگیرید.", type: "error" });
      return;
    }

    const dist = distanceMeters(userLat, userLng, branchLat, branchLng);
    if (dist > BRANCH.radiusMeters) {
      setMessage({ text: `شما خارج از محدوده مجاز هستید. ثبت حضور فقط تا فاصله ۵۰ متر امکان‌پذیر است. (فاصله فعلی: ${Math.round(dist)} متر)`, type: "error" });
      return;
    }

    try {
      setMessage({ text: "در حال ثبت...", type: "info" });
      await addDoc(collection(db, "attendance"), {
        companyId: COMPANY_ID,
        employeeName: employeeName.trim(),
        type,
        qrText,
        branchName: BRANCH.name,
        gps: { lat: userLat, lng: userLng },
        distanceMeters: Math.round(dist),
        createdAt: serverTimestamp(),
        createdAtText: nowText()
      });
      setMessage({ text: type === "check_in" ? "ورود با موفقیت ثبت شد." : "خروج با موفقیت ثبت شد.", type: "success" });
      // Reset after success
      setQrText("");
    } catch (e) {
      console.error(e);
      setMessage({ text: "خطا در ثبت اطلاعات در سرور.", type: "error" });
    }
  };

  const fetchRecords = async () => {
    if (!db) return;
    setLoadingRecords(true);
    try {
      const q = query(collection(db, "attendance"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoadingRecords(false);
  };

  return (
    <div className="min-h-screen w-full flex justify-center bg-transparent py-6 px-4">
      <div className="w-full max-w-[430px] flex flex-col gap-6">
        
        {/* Firebase Guard */}
        {!db && (
          <div className="glass-card bg-red-500/20 border-red-500/30 p-4 rounded-[18px] flex items-start gap-3">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-200 leading-relaxed">
              لطفاً تنظیمات Firebase را در پنل Secrets انجام دهید. اتصال به دیتابیس برقرار نیست.
            </p>
          </div>
        )}

        {screen === "home" && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-10 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-[#248cff] to-[#25d7a0] flex items-center justify-center shadow-lg shadow-blue-900/20">
                <span className="text-4xl font-bold text-white tracking-tighter">AT</span>
              </div>
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">ARCtime</h1>
                <p className="text-sm text-blue-200/80">حضور و غیاب آنلاین با QR + GPS</p>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-8">
              <button 
                onClick={() => setScreen("employee")}
                className="btn-primary"
                data-testid="btn-home-employee"
              >
                ورود کارمند
              </button>
              <button 
                onClick={() => {
                  setScreen("manager");
                  fetchRecords();
                }}
                className="btn-secondary"
                data-testid="btn-home-manager"
              >
                پنل مدیر
              </button>
            </div>
          </div>
        )}

        {screen === "employee" && (
          <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4">
              <button onClick={() => setScreen("home")} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="btn-back">
                <ArrowRight size={24} className="rotate-180" />
              </button>
              <h2 className="text-xl font-bold">پنل کارمند</h2>
            </div>

            <div className="glass-card p-6 flex flex-col gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80 px-1">نام شما</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  data-testid="input-employee-name"
                />
              </div>

              <div className="space-y-3">
                <div className="status-box flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <QrCode className="text-blue-400" size={20} />
                    <span className="text-sm font-medium">{qrText ? "QR اسکن شده:" : "وضعیت QR:"}</span>
                  </div>
                  <span className="text-xs text-white/60 max-w-[150px] truncate">{qrText || "هنوز اسکن نشده"}</span>
                </div>

                <div className="status-box flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <MapPin className="text-teal-400" size={20} />
                    <span className="text-sm font-medium">وضعیت GPS:</span>
                  </div>
                  <span className="text-xs text-white/60">
                    {gpsData ? `دقت: ${Math.round(gpsData.accuracy)}m` : "هنوز دریافت نشده"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => setScreen("scan")}
                  className="btn-secondary text-sm h-12"
                  data-testid="btn-scan-qr"
                >
                  اسکن QR شرکت
                </button>
                <button 
                  onClick={getGps}
                  className="btn-secondary text-sm h-12"
                  data-testid="btn-get-gps"
                >
                  دریافت GPS
                </button>
              </div>
            </div>

            {message && (
              <div className={`text-center font-medium text-sm p-3 rounded-2xl ${
                message.type === "error" ? "bg-red-500/10 text-red-400" : 
                message.type === "success" ? "bg-teal-500/10 text-teal-400" : 
                "bg-blue-500/10 text-blue-300"
              }`}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-2">
              <button 
                onClick={() => submitAttendance("check_in")}
                className="btn-primary shadow-lg shadow-teal-500/20"
                data-testid="btn-check-in"
              >
                <LogIn className="mr-2" size={18} />
                ثبت ورود
              </button>
              <button 
                onClick={() => submitAttendance("check_out")}
                className="btn-danger shadow-lg shadow-red-500/20"
                data-testid="btn-check-out"
              >
                <LogOut className="mr-2" size={18} />
                ثبت خروج
              </button>
            </div>

            <div className="mt-8 p-4 rounded-2xl border border-white/5 bg-white/5 text-center">
              <p className="text-xs text-white/50 mb-2">مقدار معتبر برای اسکن QR (جهت تست):</p>
              <code className="text-xs text-teal-300 font-mono select-all bg-black/30 p-2 rounded-lg block">
                {VALID_QR_TEXT}
              </code>
            </div>
          </div>
        )}

        {screen === "scan" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setScreen("employee")} className="p-2 rounded-full hover:bg-white/10 transition-colors" data-testid="btn-back-scan">
                <ArrowRight size={24} className="rotate-180" />
              </button>
              <h2 className="text-xl font-bold">اسکنر QR</h2>
            </div>

            <p className="text-white/70 text-center text-sm">دوربین پشتی را روی QR شرکت بگیرید</p>

            <div className="rounded-2xl overflow-hidden bg-black w-full" style={{ minHeight: 320 }}>
              <ScannerComponent onScan={(text) => {
                setQrText(text);
                setScreen("employee");
              }} />
            </div>
          </div>
        )}

        {screen === "manager" && !managerAuthed && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-8 animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-[#248cff] to-[#25d7a0] flex items-center justify-center shadow-lg shadow-blue-900/20 mb-1">
                <span className="text-2xl font-bold text-white">🔒</span>
              </div>
              <h2 className="text-xl font-bold">ورود به پنل مدیر</h2>
              <p className="text-sm text-white/50">رمز عبور را وارد کنید</p>
            </div>

            <form onSubmit={handleManagerLogin} className="w-full flex flex-col gap-4">
              <input
                type="password"
                className={`input-field text-center tracking-widest text-lg ${pwError ? "border-red-500/60" : ""}`}
                placeholder="رمز عبور"
                value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError(false); }}
                autoFocus
                data-testid="input-manager-password"
              />
              {pwError && (
                <p className="text-center text-sm text-red-400 animate-in fade-in">
                  رمز عبور اشتباه است. دوباره تلاش کنید.
                </p>
              )}
              <button type="submit" className="btn-primary" data-testid="btn-manager-login">
                ورود
              </button>
              <button
                type="button"
                onClick={() => { setScreen("home"); setPwInput(""); setPwError(false); }}
                className="btn-secondary"
              >
                بازگشت
              </button>
            </form>
          </div>
        )}

        {screen === "manager" && managerAuthed && (
          <ManagerScreen
            records={records}
            loading={loadingRecords}
            onRefresh={fetchRecords}
            onBack={() => setScreen("home")}
            onLogout={handleManagerLogout}
          />
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .glass-card {
          background: rgba(255, 255, 255, 0.09);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 28px;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .btn-primary {
          background: linear-gradient(to right, #248cff, #25d7a0);
          border-radius: 17px;
          height: 56px;
          width: 100%;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s, opacity 0.2s;
        }
        .btn-primary:active { transform: scale(0.98); }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.14);
          border-radius: 17px;
          height: 56px;
          width: 100%;
          font-weight: 600;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.2); }
        .btn-danger {
          background: linear-gradient(to right, #ff4b4b, #ff9b54);
          border-radius: 17px;
          height: 56px;
          width: 100%;
          font-weight: 700;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .input-field {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 18px;
          height: 54px;
          width: 100%;
          padding: 0 20px;
          color: white;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus {
          border-color: #248cff;
        }
        .status-box {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          padding: 14px 18px;
        }
      `}} />
    </div>
  );
}

// Separate component to handle scanner lifecycle
function ScannerComponent({ onScan }: { onScan: (text: string) => void }) {
  // Keep latest onScan in a ref so the effect never needs to re-run
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let instance: Html5QrcodeType | null = null;
    let done = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (done) return;
      instance = new Html5Qrcode("qr-reader");
      instance
        .start(
          { facingMode: "environment" },
          { fps: 15, qrbox: 240 },
          (text) => {
            if (done) return;
            done = true;
            // Switch screen immediately — React unmount will stop the camera
            onScanRef.current(text);
          },
          () => {}
        )
        .catch(() => {});
    }).catch(() => {});

    return () => {
      done = true;
      instance?.stop().catch(() => {});
    };
  }, []); // empty deps — only start once

  return <div id="qr-reader" style={{ width: "100%", height: "100%" }} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
