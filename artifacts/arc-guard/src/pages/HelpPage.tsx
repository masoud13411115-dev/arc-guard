import { useState } from "react";
import {
  ArrowLeft, Building2, UserPlus, MapPin, QrCode, FileText,
  Bell, Map, Settings, LogIn, Camera, AlertTriangle, Phone,
  LogOut, ChevronDown, ChevronUp, HelpCircle, BookOpen,
  Lightbulb, Wrench, MessageCircleQuestion, Shield,
} from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import arcGuardLogo from "/arc-guard-logo.png";

// ─── Content types ─────────────────────────────────────────────────────────────
type HelpSection = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  steps: string[];
  tip?: string;
};
type FaqItem       = { q: string; a: string };
type TroubleItem   = { issue: string; fix: string };
type HelpData = {
  pageTitle:       string;
  managerTitle:    string;
  guardTitle:      string;
  faqTitle:        string;
  troubleTitle:    string;
  backLabel:       string;
  stepsLabel:      string;
  tipLabel:        string;
  manager:         HelpSection[];
  guard:           HelpSection[];
  faq:             FaqItem[];
  troubleshooting: TroubleItem[];
};

// ─── Content dictionary ────────────────────────────────────────────────────────
const CONTENT: Record<Lang, HelpData> = {
  // ── Persian (fa) ─────────────────────────────────────────────────────────────
  fa: {
    pageTitle:    "راهنمای کاربر",
    managerTitle: "راهنمای مدیر",
    guardTitle:   "راهنمای نگهبان",
    faqTitle:     "سؤالات متداول",
    troubleTitle: "رفع اشکال",
    backLabel:    "بازگشت",
    stepsLabel:   "مراحل",
    tipLabel:     "نکته",
    manager: [
      {
        id: "register",
        icon: Building2,
        title: "ثبت شرکت",
        description: "اولین قدم پس از نصب، ایجاد حساب مدیر و ثبت اطلاعات شرکت است.",
        steps: [
          "به آدرس /manager بروید و روی «اولین بار است؟ ثبت‌نام» کلیک کنید.",
          "نام کاربری و رمز عبور انتخاب کنید و نام شرکت را وارد کنید.",
          "پس از ثبت‌نام، وارد داشبورد می‌شوید. کد دعوت شرکت را از تب تنظیمات کپی کنید.",
          "این کد دعوت را به نگهبانان بدهید تا هنگام ثبت‌نام استفاده کنند.",
        ],
        tip: "کد دعوت را محرمانه نگه دارید. در صورت لزوم از تب تنظیمات کد جدید بسازید.",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "تعریف نگهبان",
        description: "نگهبانان پس از دریافت کد دعوت شرکت می‌توانند ثبت‌نام کنند.",
        steps: [
          "کد دعوت شرکت را از تب تنظیمات (Settings) داشبورد کپی کنید.",
          "کد دعوت را برای نگهبان ارسال کنید.",
          "نگهبان به /guard می‌رود، روی «ثبت‌نام با کد دعوت» کلیک می‌کند.",
          "نگهبان کد اختصاصی (مثلاً G001)، کد دعوت شرکت، نام کامل و PIN را وارد می‌کند.",
          "پس از ثبت‌نام، نگهبان در تب نظارت (Monitor) داشبورد ظاهر می‌شود.",
        ],
        tip: "کد نگهبان مثل G001 باید منحصربه‌فرد باشد. از کدهای ساده و قابل به‌یادسپاری استفاده کنید.",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "تعریف ایستگاه",
        description: "ایستگاه‌ها نقاطی هستند که نگهبانان باید در بازه‌های مشخص از آن‌ها عبور کنند.",
        steps: [
          "از منوی چپ روی «ایستگاه‌ها» کلیک کنید.",
          "دکمه «افزودن ایستگاه» را بزنید.",
          "نام ایستگاه و توضیح موقعیت را وارد کنید.",
          "روی «استفاده از موقعیت فعلی» کلیک کنید یا مختصات GPS را دستی وارد کنید.",
          "شعاع مجاز (متر) و بازه گشت را تنظیم کنید.",
          "ذخیره کنید — QR ایستگاه به‌طور خودکار ساخته می‌شود.",
        ],
        tip: "شعاع مجاز را متناسب با اندازه مکان تنظیم کنید. برای ورودی‌های باریک ۵۰ متر و برای فضای باز ۲۰۰ متر مناسب است.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "ساخت و چاپ QR",
        description: "هر ایستگاه یک QR Code اختصاصی دارد که باید در محل نصب شود.",
        steps: [
          "در تب ایستگاه‌ها، روی ایستگاه موردنظر کلیک کنید.",
          "بخش «مشاهده QR Code» را باز کنید.",
          "روی «دانلود PNG» یا «دانلود SVG» کلیک کنید.",
          "برای چاپ مستقیم، دکمه «چاپ QR» را بزنید.",
          "QR چاپ‌شده را در محل فیزیکی ایستگاه نصب کنید.",
        ],
        tip: "QR را در ارتفاع ۱۲۰–۱۵۰ سانتی‌متری نصب کنید و از پوشش پلاستیکی برای محافظت در برابر آب‌وهوا استفاده کنید.",
      },
      {
        id: "logs",
        icon: FileText,
        title: "مشاهده گزارش گشت",
        description: "تمام اسکن‌های انجام‌شده توسط نگهبانان با جزئیات GPS ثبت می‌شود.",
        steps: [
          "از منوی چپ روی «گزارش گشت» کلیک کنید.",
          "با فیلتر نام نگهبان، ایستگاه، تاریخ یا وضعیت، نتایج را محدود کنید.",
          "برای هر اسکن: نام نگهبان، ایستگاه، زمان، فاصله GPS و وضعیت نمایش داده می‌شود.",
          "برای خروجی اکسل، دکمه «دانلود CSV» را بزنید.",
        ],
        tip: "وضعیت‌ها: سبز = اسکن موفق در محدوده، نارنجی = خارج از شعاع مجاز، قرمز = خطا.",
      },
      {
        id: "alerts",
        icon: Bell,
        title: "مشاهده هشدارها و SOS",
        description: "هشدارهای فوری SOS و هشدارهای سیستم در این بخش نمایش داده می‌شوند.",
        steps: [
          "از منوی چپ روی «هشدارها» کلیک کنید (اگر هشدار جدید باشد نشانگر قرمز می‌بینید).",
          "هشدارهای SOS با رنگ قرمز و انیمیشن چشمک‌زن نمایش داده می‌شوند.",
          "برای مشاهده جزئیات روی هشدار کلیک کنید (موقعیت GPS، نگهبان، زمان).",
          "پس از رسیدگی، دکمه «تأیید و بستن» را بزنید تا هشدار حل‌شده علامت‌گذاری شود.",
        ],
        tip: "اعلان مرورگر را فعال کنید تا SOS‌ها حتی زمانی که برگه باز نیست به شما اطلاع داده شود.",
      },
      {
        id: "map",
        icon: Map,
        title: "نقشه زنده",
        description: "موقعیت لحظه‌ای همه نگهبانان فعال روی نقشه نمایش داده می‌شود.",
        steps: [
          "از منوی چپ روی «نقشه» کلیک کنید.",
          "نقاط آبی موقعیت نگهبانان فعال را نشان می‌دهند.",
          "نقاط سبز موقعیت ایستگاه‌های تعریف‌شده را نشان می‌دهند.",
          "روی هر نقطه کلیک کنید تا اطلاعات بیشتر (نام، زمان آخرین گزارش) ببینید.",
        ],
        tip: "نقشه به‌صورت لحظه‌ای از Firestore به‌روزرسانی می‌شود. برای دقت بالاتر، نگهبانان باید GPS دقیق داشته باشند.",
      },
      {
        id: "settings",
        icon: Settings,
        title: "تنظیمات شرکت",
        description: "اطلاعات شرکت، کد دعوت و وضعیت اشتراک را از این بخش مدیریت کنید.",
        steps: [
          "از منوی چپ روی «تنظیمات» کلیک کنید.",
          "در بخش «اطلاعات شرکت» نام و اطلاعات پایه را ببینید.",
          "در بخش «کد دعوت»، کد را کپی کرده و برای نگهبانان جدید ارسال کنید.",
          "برای امنیت بیشتر، دکمه «ساخت کد جدید» کد دعوت قدیمی را باطل و کد جدید صادر می‌کند.",
          "در بخش «اشتراک» نوع پلن خود را مشاهده کنید.",
        ],
        tip: "هر بار که کد دعوت را بازسازی کنید، نگهبانانی که هنوز ثبت‌نام نکرده‌اند باید از کد جدید استفاده کنند.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "ورود نگهبان",
        description: "برای ورود به اپ نگهبان به کد نگهبان و PIN نیاز دارید.",
        steps: [
          "به آدرس /guard بروید.",
          "کد نگهبان اختصاصی خود (مثلاً G001) را از مدیر دریافت کنید.",
          "کد دعوت شرکت را از مدیر دریافت کنید.",
          "اگر اولین بار است روی «ثبت‌نام» کلیک کنید و اطلاعات را وارد کنید.",
          "پس از ثبت‌نام، با کد نگهبان و PIN وارد شوید.",
        ],
        tip: "PIN خود را حفظ کنید — برای بازیابی باید با مدیر تماس بگیرید.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "اجازه GPS و دوربین",
        description: "اپ به دسترسی GPS و دوربین نیاز دارد تا بتواند ایستگاه‌ها را اسکن و موقعیت شما را تأیید کند.",
        steps: [
          "هنگام اولین ورود، مرورگر از شما اجازه «دسترسی به موقعیت مکانی» می‌خواهد — «اجازه» را بزنید.",
          "هنگام اولین اسکن، مرورگر از شما اجازه «دسترسی به دوربین» می‌خواهد — «اجازه» را بزنید.",
          "اگر اجازه را اشتباه رد کردید: در مرورگر روی آیکون قفل/دوربین کنار آدرس کلیک کنید و مجوز را فعال کنید.",
        ],
        tip: "GPS باید همیشه روشن باشد. اگر «GPS خطا» می‌بینید، مطمئن شوید Location در تنظیمات گوشی فعال است.",
      },
      {
        id: "scan",
        icon: QrCode,
        title: "اسکن ایستگاه",
        description: "برای ثبت گشت در هر ایستگاه، QR code آن را اسکن کنید.",
        steps: [
          "روی دکمه بزرگ «اسکن ایستگاه» در مرکز صفحه بزنید.",
          "دوربین باز می‌شود — QR code روی ایستگاه را در مرکز قاب قرار دهید.",
          "پس از شناسایی QR، دوربین بسته می‌شود و GPS موقعیت شما را می‌گیرد.",
          "نتیجه نمایش داده می‌شود: سبز = موفق، نارنجی = خارج از محدوده، قرمز = خطا.",
          "نتیجه پس از ۴.۵ ثانیه به‌طور خودکار بسته می‌شود.",
        ],
        tip: "هر ایستگاه فقط یک بار در ۵ دقیقه قابل اسکن است. اگر «زود است» می‌بینید، صبر کنید.",
      },
      {
        id: "outside",
        icon: AlertTriangle,
        title: "خطای خارج از محدوده",
        description: "این خطا نشان می‌دهد موقعیت GPS شما دورتر از شعاع مجاز ایستگاه است.",
        steps: [
          "به QR کد نزدیک‌تر شوید — باید مستقیم جلوی ایستگاه باشید.",
          "صبر کنید تا GPS دقیق‌تر شود (چند ثانیه طول می‌کشد).",
          "مطمئن شوید ساختمان یا دیوار بین شما و ایستگاه نباشد.",
          "اگر مشکل ادامه دارد با مدیر تماس بگیرید — شاید شعاع ایستگاه باید بیشتر شود.",
        ],
        tip: "دقت GPS در فضای باز بهتر است. در محیط بسته گاهی ۲۰–۳۰ ثانیه طول می‌کشد تا موقعیت دقیق بگیرد.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "ارسال SOS",
        description: "در شرایط اضطراری، دکمه SOS را برای اطلاع‌رسانی فوری به مدیر نگه دارید.",
        steps: [
          "دکمه SOS قرمزرنگ را در صفحه اصلی پیدا کنید.",
          "دکمه را ۳ ثانیه نگه دارید — نوار پیشرفت پر می‌شود.",
          "وقتی نوار کامل شد دست بردارید — هشدار SOS با موقعیت GPS شما به مدیر ارسال می‌شود.",
          "مدیر در داشبورد خود هشدار قرمز را بلافاصله می‌بیند.",
        ],
        tip: "SOS حتی در حالت آفلاین ذخیره می‌شود و به محض اتصال مجدد ارسال خواهد شد.",
      },
      {
        id: "logout",
        icon: LogOut,
        title: "خروج از سیستم",
        description: "در پایان شیفت از سیستم خارج شوید.",
        steps: [
          "دکمه «خروج» در گوشه بالا-راست صفحه را بزنید.",
          "یا روی آیکون منو کلیک کنید و «خروج از سیستم» را انتخاب کنید.",
          "پس از خروج، صفحه ورود نمایش داده می‌شود.",
        ],
        tip: "لاگ گشت شما حتی پس از خروج در سیستم ثبت می‌ماند و مدیر می‌تواند آن را مشاهده کند.",
      },
    ],
    faq: [
      { q: "آیا اپ بدون اینترنت کار می‌کند؟", a: "بله — اسکن‌ها در حالت آفلاین در صف نگه داشته می‌شوند و به محض اتصال مجدد به اینترنت ارسال می‌شوند. نشانگر زرد بالای صفحه تعداد اسکن‌های در صف را نشان می‌دهد." },
      { q: "اگر PIN خود را فراموش کردم چه کار کنم؟", a: "با مدیر شرکت تماس بگیرید. مدیر می‌تواند حساب نگهبان را حذف و دوباره ثبت‌نام کند." },
      { q: "QR code را هر چند وقت یک‌بار تغییر دهیم؟", a: "QR code به‌صورت امن پشت رمزگذاری قرار دارد و نیازی به تغییر منظم ندارد. فقط در صورت مفقود شدن یا آسیب فیزیکی آن را تعویض کنید." },
      { q: "آیا می‌توانم از یک گوشی با چند شرکت کار کنم؟", a: "هر نگهبان به یک شرکت خاص متصل است. برای تغییر شرکت باید خارج شده و با اطلاعات جدید ثبت‌نام کنید." },
      { q: "چند نگهبان می‌توانم اضافه کنم؟", a: "پلن اولیه (Basic) تا ۵ نگهبان، پلن حرفه‌ای (Professional) تا ۲۰ نگهبان و پلن سازمانی (Enterprise) نامحدود پشتیبانی می‌کند." },
    ],
    troubleshooting: [
      { issue: "GPS وصل نمی‌شود / دقت پایین دارد", fix: "مطمئن شوید Location در تنظیمات گوشی فعال است. مرورگر را ببندید و دوباره باز کنید. در فضای باز بهتر کار می‌کند." },
      { issue: "دوربین باز نمی‌شود", fix: "در مرورگر روی آیکون قفل کنار آدرس کلیک کنید، دسترسی دوربین را به «اجازه» تغییر دهید و صفحه را رفرش کنید." },
      { issue: "اسکن موفق است ولی در گزارش نمایش داده نمی‌شود", fix: "اگر در حالت آفلاین بودید، پس از اتصال به اینترنت داده‌ها همگام‌سازی می‌شوند. نشانگر زرد را بررسی کنید." },
      { issue: "وضعیت Firebase: متصل نیست", fix: "اتصال اینترنت خود را بررسی کنید. سپس صفحه را رفرش کنید. اگر مشکل ادامه دارد با پشتیبانی تماس بگیرید." },
      { issue: "نگهبان در داشبورد دیده نمی‌شود", fix: "مطمئن شوید نگهبان با کد دعوت صحیح ثبت‌نام کرده است. در تب Monitor ببینید آیا session فعال دارند." },
      { issue: "اعلان SOS دریافت نمی‌کنم", fix: "اعلان مرورگر را در تب تنظیمات (Settings) فعال کنید. مطمئن شوید برگه مرورگر باز است." },
    ],
  },

  // ── English (en) ──────────────────────────────────────────────────────────────
  en: {
    pageTitle:    "User Manual",
    managerTitle: "Manager Manual",
    guardTitle:   "Guard Manual",
    faqTitle:     "Frequently Asked Questions",
    troubleTitle: "Troubleshooting",
    backLabel:    "Back",
    stepsLabel:   "Steps",
    tipLabel:     "Tip",
    manager: [
      {
        id: "register",
        icon: Building2,
        title: "Company Registration",
        description: "The first step after setup is creating a manager account and registering your company.",
        steps: [
          "Go to /manager and click 'First time? Register with invite code'.",
          "Choose a username and password, then enter your company name.",
          "After registration you'll see the Dashboard. Copy the invite code from the Settings tab.",
          "Share this invite code with your guards — they'll need it to register.",
        ],
        tip: "Keep the invite code confidential. Regenerate it anytime from Settings if it's compromised.",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "Adding Guards",
        description: "Guards register themselves using your company's invite code.",
        steps: [
          "Copy your company invite code from the Settings tab in the Dashboard.",
          "Send the invite code to the guard.",
          "The guard goes to /guard and clicks 'Register with company invite code'.",
          "The guard enters their unique guard code (e.g. G001), the invite code, full name, and a PIN.",
          "After registration, the guard appears in the Monitor tab of your Dashboard.",
        ],
        tip: "Guard codes like G001 must be unique. Use simple, memorable codes and keep a record of them.",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "Adding Checkpoints",
        description: "Checkpoints are physical locations that guards must visit within set intervals.",
        steps: [
          "Click 'Checkpoints' in the left menu.",
          "Click the 'Add Checkpoint' button.",
          "Enter the checkpoint name and a location description.",
          "Click 'Use Current Location (GPS)' or enter GPS coordinates manually.",
          "Set the allowed radius (meters) and patrol interval.",
          "Save — the QR code is generated automatically.",
        ],
        tip: "Set the radius to match the physical location. 50m for narrow entrances, 200m for open areas.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "QR Code Creation & Printing",
        description: "Each checkpoint has a unique QR code that must be physically installed at the location.",
        steps: [
          "In the Checkpoints tab, click on the checkpoint you want.",
          "Expand the 'View & Download QR Code' section.",
          "Click 'Download PNG' or 'Download SVG' for a file.",
          "Click 'Print QR' to print directly from the browser.",
          "Install the printed QR at the physical checkpoint location.",
        ],
        tip: "Mount the QR at 120–150 cm height and use a plastic laminate to protect it from weather.",
      },
      {
        id: "logs",
        icon: FileText,
        title: "Viewing Patrol Reports",
        description: "All guard scans are logged with full GPS details and timestamps.",
        steps: [
          "Click 'Patrol Logs' in the left menu.",
          "Filter by guard name, checkpoint, date range, or status.",
          "Each record shows: guard name, checkpoint, scan time, GPS distance, and status.",
          "Click 'Export CSV' to download an Excel-compatible file.",
        ],
        tip: "Status colours: green = valid scan within radius, orange = outside allowed radius, red = error.",
      },
      {
        id: "alerts",
        icon: Bell,
        title: "Alerts & SOS Management",
        description: "Urgent SOS alerts and system warnings appear here in real time.",
        steps: [
          "Click 'Alerts' in the left menu (a red badge appears if new alerts exist).",
          "SOS alerts are shown in red with a flashing animation.",
          "Click an alert to view details: GPS location, guard name, timestamp.",
          "Click 'Confirm & Close Alert' once the situation has been handled.",
        ],
        tip: "Enable browser notifications in Settings so SOS alerts reach you even when the tab is in the background.",
      },
      {
        id: "map",
        icon: Map,
        title: "Live Map",
        description: "See the real-time location of all active guards on an interactive map.",
        steps: [
          "Click 'Map' in the left menu.",
          "Blue dots show the current position of active guards.",
          "Green dots show defined checkpoint locations.",
          "Click any dot to see more details (name, last report time).",
        ],
        tip: "The map updates in real time from Firestore. For higher accuracy, guards need a strong GPS signal.",
      },
      {
        id: "settings",
        icon: Settings,
        title: "Company Settings",
        description: "Manage company info, invite code, and subscription plan from here.",
        steps: [
          "Click 'Settings' in the left menu.",
          "The 'Company Info' section shows your company name and admin username.",
          "In 'Guard Invite Code', copy and share the code with new guards.",
          "Click 'Regenerate' to invalidate the old code and issue a new one.",
          "The 'Plan' section shows your current subscription tier.",
        ],
        tip: "When you regenerate the invite code, guards who haven't registered yet must use the new code.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "Guard Login",
        description: "To access the guard app you need your guard code and PIN.",
        steps: [
          "Go to /guard.",
          "Get your unique guard code (e.g. G001) from your manager.",
          "Get the company invite code from your manager.",
          "If first time: click 'Register' and fill in your details.",
          "After registration, sign in with your guard code and PIN.",
        ],
        tip: "Memorise your PIN — to recover it you'll need to contact your manager.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "GPS & Camera Permissions",
        description: "The app needs GPS and camera access to scan checkpoints and verify your location.",
        steps: [
          "On first login, the browser asks for 'Location' access — tap Allow.",
          "On first scan, the browser asks for 'Camera' access — tap Allow.",
          "If you denied by mistake: click the lock/camera icon in the browser address bar and set permissions to Allow.",
        ],
        tip: "GPS must be on at all times. If you see 'GPS Error', make sure Location is enabled in your phone settings.",
      },
      {
        id: "scan",
        icon: QrCode,
        title: "Scanning a Checkpoint",
        description: "Scan the QR code at each checkpoint to record your patrol visit.",
        steps: [
          "Tap the large 'Scan Checkpoint' button in the centre of the screen.",
          "The camera opens — point it at the QR code on the checkpoint.",
          "Once the QR is recognised, the camera closes and GPS captures your position.",
          "Result is shown: green = success, orange = outside range, red = error.",
          "The result auto-dismisses after 4.5 seconds.",
        ],
        tip: "Each checkpoint can only be scanned once every 5 minutes. If you see 'Too soon', wait a moment.",
      },
      {
        id: "outside",
        icon: AlertTriangle,
        title: "Out of Range Error",
        description: "This means your GPS position is farther from the checkpoint than the allowed radius.",
        steps: [
          "Move closer to the QR code — you should be standing directly in front of the checkpoint.",
          "Wait a few seconds for GPS to get a more accurate fix.",
          "Make sure there are no walls or buildings blocking the GPS signal.",
          "If the problem persists, contact your manager — the checkpoint radius may need to be increased.",
        ],
        tip: "GPS is more accurate outdoors. In enclosed spaces it can take 20–30 seconds to get a precise location.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "Sending SOS",
        description: "In an emergency, hold the SOS button to instantly alert your manager.",
        steps: [
          "Find the red SOS button on the main screen.",
          "Hold it down for 3 seconds — watch the progress bar fill up.",
          "Release when the bar is full — an SOS alert with your GPS location is sent to the manager.",
          "The manager sees a red flashing alert on their Dashboard immediately.",
        ],
        tip: "SOS is saved offline too. If you're offline, it will be sent as soon as the connection is restored.",
      },
      {
        id: "logout",
        icon: LogOut,
        title: "Logging Out",
        description: "Log out at the end of your shift.",
        steps: [
          "Tap the 'Logout' button in the top-right corner of the screen.",
          "Or open the menu and select 'Log out of system'.",
          "The login screen will appear.",
        ],
        tip: "Your patrol log remains in the system after logout — your manager can still view it.",
      },
    ],
    faq: [
      { q: "Does the app work without internet?", a: "Yes — scans are queued offline and sent automatically when the connection is restored. The yellow indicator at the top shows how many scans are waiting." },
      { q: "What if I forget my PIN?", a: "Contact your company manager. The manager can delete and re-register your guard account with a new PIN." },
      { q: "How often should I change the QR codes?", a: "QR codes are cryptographically secured and don't need regular rotation. Replace them only if they're physically lost or damaged." },
      { q: "Can I use one device for multiple companies?", a: "Each guard is linked to one company. To switch companies, log out and register again with the new company's invite code." },
      { q: "How many guards can I add?", a: "Basic plan: up to 5 guards. Professional: up to 20 guards. Enterprise: unlimited." },
    ],
    troubleshooting: [
      { issue: "GPS won't connect / low accuracy", fix: "Check Location is enabled in your phone settings. Close and reopen the browser. Works better outdoors." },
      { issue: "Camera won't open", fix: "In your browser, click the lock icon next to the address bar, set Camera permission to Allow, then refresh the page." },
      { issue: "Scan is successful but doesn't appear in reports", fix: "If you were offline, data syncs when you reconnect. Check the yellow indicator at the top of the screen." },
      { issue: "Firebase status shows 'not connected'", fix: "Check your internet connection, then refresh the page. If the problem persists, contact support." },
      { issue: "Guard doesn't appear in the Dashboard", fix: "Make sure the guard registered with the correct company invite code. Check the Monitor tab for active sessions." },
      { issue: "Not receiving SOS notifications", fix: "Enable browser notifications in the Settings tab. Make sure the browser tab is open." },
    ],
  },

  // ── Turkish (tr) ──────────────────────────────────────────────────────────────
  tr: {
    pageTitle:    "Kullanım Kılavuzu",
    managerTitle: "Yönetici Kılavuzu",
    guardTitle:   "Güvenlik Kılavuzu",
    faqTitle:     "Sık Sorulan Sorular",
    troubleTitle: "Sorun Giderme",
    backLabel:    "Geri",
    stepsLabel:   "Adımlar",
    tipLabel:     "İpucu",
    manager: [
      {
        id: "register",
        icon: Building2,
        title: "Şirket Kaydı",
        description: "Kurulumdan sonraki ilk adım, yönetici hesabı oluşturmak ve şirketinizi kaydetmektir.",
        steps: [
          "/manager adresine gidin ve 'İlk kez mi? Davet koduyla kayıt ol' seçeneğine tıklayın.",
          "Kullanıcı adı ve şifre seçin, ardından şirket adınızı girin.",
          "Kayıt sonrası Dashboard görünür. Davet kodunu Ayarlar sekmesinden kopyalayın.",
          "Bu davet kodunu güvenlik görevlilerinizle paylaşın.",
        ],
        tip: "Davet kodunu gizli tutun. Tehlikeye girerse Ayarlar'dan yenisini oluşturabilirsiniz.",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "Güvenlik Tanımlama",
        description: "Güvenlik görevlileri, şirket davet kodunu kullanarak kendileri kayıt olur.",
        steps: [
          "Şirket davet kodunuzu Dashboard'daki Ayarlar sekmesinden kopyalayın.",
          "Davet kodunu güvenlik görevlisine gönderin.",
          "Güvenlik /guard adresine gider ve 'Şirket davet koduyla kayıt ol' seçeneğine tıklar.",
          "Güvenlik görevlisi kodu (ör. G001), davet kodu, ad-soyad ve PIN girer.",
          "Kayıt sonrası güvenlik, Dashboard'unuzun İzleme (Monitor) sekmesinde görünür.",
        ],
        tip: "G001 gibi güvenlik kodları benzersiz olmalıdır. Basit ve akılda kalıcı kodlar kullanın.",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "Kontrol Noktası Tanımlama",
        description: "Kontrol noktaları, güvenlik görevlilerinin belirli aralıklarla ziyaret etmesi gereken fiziksel konumlardır.",
        steps: [
          "Sol menüden 'Kontrol Noktaları' seçeneğine tıklayın.",
          "'Kontrol Noktası Ekle' düğmesine tıklayın.",
          "Kontrol noktası adını ve konum açıklamasını girin.",
          "'Mevcut Konumu Kullan (GPS)' seçeneğine tıklayın veya koordinatları elle girin.",
          "İzin verilen yarıçapı (metre) ve devriye aralığını ayarlayın.",
          "Kaydedin — QR kodu otomatik oluşturulur.",
        ],
        tip: "Yarıçapı fiziksel konuma göre ayarlayın. Dar girişler için 50m, açık alanlar için 200m uygundur.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "QR Kodu Oluşturma ve Yazdırma",
        description: "Her kontrol noktasının, fiziksel konumda asılması gereken benzersiz bir QR kodu vardır.",
        steps: [
          "Kontrol Noktaları sekmesinde ilgili noktaya tıklayın.",
          "'QR Kodunu Görüntüle ve İndir' bölümünü genişletin.",
          "Dosya için 'PNG İndir' veya 'SVG İndir' seçeneğine tıklayın.",
          "Tarayıcıdan doğrudan yazdırmak için 'QR Yazdır' düğmesine tıklayın.",
          "Yazdırılan QR'ı fiziksel kontrol noktasına yapıştırın.",
        ],
        tip: "QR'ı 120–150 cm yüksekliğe asın ve hava koşullarından korumak için laminat kaplama kullanın.",
      },
      {
        id: "logs",
        icon: FileText,
        title: "Devriye Raporlarını Görüntüleme",
        description: "Tüm güvenlik taramaları GPS detayları ve zaman damgalarıyla kaydedilir.",
        steps: [
          "Sol menüden 'Devriye Günlüğü' seçeneğine tıklayın.",
          "Güvenlik adı, kontrol noktası, tarih aralığı veya duruma göre filtreleyin.",
          "Her kayıt şunları gösterir: güvenlik adı, kontrol noktası, tarama zamanı, GPS mesafesi, durum.",
          "Excel uyumlu dosya için 'CSV İndir' düğmesine tıklayın.",
        ],
        tip: "Durum renkleri: yeşil = yarıçap içinde geçerli tarama, turuncu = izin verilen yarıçap dışında, kırmızı = hata.",
      },
      {
        id: "alerts",
        icon: Bell,
        title: "Uyarı ve SOS Yönetimi",
        description: "Acil SOS uyarıları ve sistem bildirimleri burada gerçek zamanlı olarak görünür.",
        steps: [
          "Sol menüden 'Uyarılar' seçeneğine tıklayın (yeni uyarı varsa kırmızı rozet görünür).",
          "SOS uyarıları yanıp sönen animasyonla kırmızı renkte gösterilir.",
          "Detayları görmek için uyarıya tıklayın: GPS konumu, güvenlik adı, zaman damgası.",
          "Durum çözüldükten sonra 'Onayla ve Kapat' düğmesine tıklayın.",
        ],
        tip: "Sekme arka planda olsa bile SOS uyarıları size ulaşsın diye Ayarlar'dan tarayıcı bildirimlerini etkinleştirin.",
      },
      {
        id: "map",
        icon: Map,
        title: "Canlı Harita",
        description: "Tüm aktif güvenlik görevlilerinin anlık konumunu interaktif haritada görün.",
        steps: [
          "Sol menüden 'Harita' seçeneğine tıklayın.",
          "Mavi noktalar aktif güvenlik görevlilerinin konumunu gösterir.",
          "Yeşil noktalar tanımlı kontrol noktalarını gösterir.",
          "Daha fazla detay için (ad, son rapor zamanı) herhangi bir noktaya tıklayın.",
        ],
        tip: "Harita Firestore'dan gerçek zamanlı güncellenir. Daha yüksek doğruluk için güvenlik görevlilerinin güçlü GPS sinyali olması gerekir.",
      },
      {
        id: "settings",
        icon: Settings,
        title: "Şirket Ayarları",
        description: "Şirket bilgilerini, davet kodunu ve abonelik planını buradan yönetin.",
        steps: [
          "Sol menüden 'Ayarlar' seçeneğine tıklayın.",
          "'Şirket Bilgileri' bölümünde şirket adınızı ve yönetici kullanıcı adınızı görün.",
          "'Güvenlik Davet Kodu' bölümünde kodu kopyalayıp yeni güvenlik görevlileriyle paylaşın.",
          "Eski kodu geçersiz kılmak ve yeni kod oluşturmak için 'Yenile' seçeneğine tıklayın.",
          "'Plan' bölümünde mevcut abonelik seviyenizi görün.",
        ],
        tip: "Davet kodunu yenilediğinizde, henüz kayıt olmamış güvenlik görevlilerinin yeni kodu kullanması gerekir.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "Güvenlik Girişi",
        description: "Güvenlik uygulamasına erişmek için güvenlik kodunuza ve PIN'inize ihtiyacınız var.",
        steps: [
          "/guard adresine gidin.",
          "Yöneticinizden benzersiz güvenlik kodunuzu (ör. G001) alın.",
          "Yöneticinizden şirket davet kodunu alın.",
          "İlk kez ise 'Kayıt Ol' seçeneğine tıklayın ve bilgilerinizi doldurun.",
          "Kayıt sonrası güvenlik kodunuz ve PIN ile giriş yapın.",
        ],
        tip: "PIN'inizi ezberleyin — kurtarmak için yöneticinizle iletişime geçmeniz gerekir.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "GPS ve Kamera İzinleri",
        description: "Uygulama, kontrol noktalarını taramak ve konumunuzu doğrulamak için GPS ve kamera erişimi gerektirir.",
        steps: [
          "İlk girişte tarayıcı 'Konum' erişimi ister — İzin Ver'e tıklayın.",
          "İlk taramada tarayıcı 'Kamera' erişimi ister — İzin Ver'e tıklayın.",
          "Yanlışlıkla reddettiyseniz: tarayıcının adres çubuğundaki kilit/kamera simgesine tıklayın ve izni Etkinleştir'e çevirin.",
        ],
        tip: "GPS her zaman açık olmalıdır. 'GPS Hatası' görüyorsanız telefon ayarlarında Konum'un etkin olduğundan emin olun.",
      },
      {
        id: "scan",
        icon: QrCode,
        title: "Kontrol Noktası Tarama",
        description: "Devriye ziyaretinizi kaydetmek için her kontrol noktasındaki QR kodu tarayın.",
        steps: [
          "Ekranın ortasındaki büyük 'Kontrol Noktası Tara' düğmesine dokunun.",
          "Kamera açılır — kontrol noktasındaki QR koduna doğrultun.",
          "QR tanındığında kamera kapanır ve GPS konumunuzu alır.",
          "Sonuç gösterilir: yeşil = başarı, turuncu = menzil dışı, kırmızı = hata.",
          "Sonuç 4,5 saniye sonra otomatik kapanır.",
        ],
        tip: "Her kontrol noktası yalnızca 5 dakikada bir taranabilir. 'Çok erken' görüyorsanız bekleyin.",
      },
      {
        id: "outside",
        icon: AlertTriangle,
        title: "Menzil Dışı Hatası",
        description: "Bu, GPS konumunuzun kontrol noktasının izin verilen yarıçapından daha uzakta olduğu anlamına gelir.",
        steps: [
          "QR koduna yaklaşın — kontrol noktasının tam önünde durmalısınız.",
          "GPS'in daha doğru sonuç alması için birkaç saniye bekleyin.",
          "Duvarlar veya binaların GPS sinyalini engellemediğinden emin olun.",
          "Sorun devam ederse yöneticinizle iletişime geçin — kontrol noktası yarıçapı artırılabilir.",
        ],
        tip: "GPS açık alanda daha doğru çalışır. Kapalı mekanlarda kesin konum almak 20–30 saniye sürebilir.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "SOS Gönderme",
        description: "Acil bir durumda, yöneticinizi anında uyarmak için SOS düğmesini basılı tutun.",
        steps: [
          "Ana ekrandaki kırmızı SOS düğmesini bulun.",
          "3 saniye basılı tutun — ilerleme çubuğunun dolduğunu izleyin.",
          "Çubuk dolduğunda bırakın — GPS konumunuzla birlikte yöneticiye SOS uyarısı gönderilir.",
          "Yönetici Dashboard'unda kırmızı yanıp sönen uyarıyı anında görür.",
        ],
        tip: "SOS çevrimdışıyken de kaydedilir. Bağlantı kesikse yeniden bağlandığınızda otomatik gönderilir.",
      },
      {
        id: "logout",
        icon: LogOut,
        title: "Sistemden Çıkış",
        description: "Vardiya sonunda sistemden çıkış yapın.",
        steps: [
          "Ekranın sağ üst köşesindeki 'Çıkış' düğmesine tıklayın.",
          "Veya menüyü açın ve 'Sistemden Çıkış Yap' seçeneğini seçin.",
          "Giriş ekranı görünecektir.",
        ],
        tip: "Çıkış yaptıktan sonra devriye günlüğünüz sistemde kalır — yöneticiniz yine de görüntüleyebilir.",
      },
    ],
    faq: [
      { q: "Uygulama internetsiz çalışır mı?", a: "Evet — taramalar çevrimdışı kuyruğa alınır ve bağlantı yeniden kurulduğunda otomatik gönderilir. Üstteki sarı gösterge bekleyen tarama sayısını gösterir." },
      { q: "PIN'imi unutursam ne yapmalıyım?", a: "Şirket yöneticinizle iletişime geçin. Yönetici güvenlik hesabınızı silebilir ve yeni PIN ile yeniden kayıt yapabilirsiniz." },
      { q: "QR kodlarını ne sıklıkla değiştirmeliyim?", a: "QR kodları kriptografik olarak güvenlidir ve düzenli rotasyon gerektirmez. Yalnızca fiziksel olarak kaybolursa veya hasar görürse değiştirin." },
      { q: "Bir cihazı birden fazla şirket için kullanabilir miyim?", a: "Her güvenlik görevlisi bir şirkete bağlıdır. Şirket değiştirmek için çıkış yapın ve yeni şirketin davet koduyla yeniden kayıt olun." },
      { q: "Kaç güvenlik görevlisi ekleyebilirim?", a: "Basic plan: 5 güvenlik. Professional: 20 güvenlik. Enterprise: sınırsız." },
    ],
    troubleshooting: [
      { issue: "GPS bağlanmıyor / düşük doğruluk", fix: "Telefon ayarlarında Konum'un etkin olduğunu kontrol edin. Tarayıcıyı kapatıp yeniden açın. Açık havada daha iyi çalışır." },
      { issue: "Kamera açılmıyor", fix: "Tarayıcıda adres çubuğunun yanındaki kilit simgesine tıklayın, Kamera iznini İzin Ver olarak ayarlayın, sayfayı yenileyin." },
      { issue: "Tarama başarılı ama raporlarda görünmüyor", fix: "Çevrimdışıysanız yeniden bağlandığınızda veriler senkronize edilir. Ekranın üstündeki sarı göstergeyi kontrol edin." },
      { issue: "Firebase durumu 'bağlı değil' gösteriyor", fix: "İnternet bağlantınızı kontrol edin, ardından sayfayı yenileyin. Sorun devam ederse destek ile iletişime geçin." },
      { issue: "Güvenlik görevlisi Dashboard'da görünmüyor", fix: "Güvenlik görevlisinin doğru şirket davet koduyla kayıt olduğundan emin olun. Aktif oturumlar için İzleme sekmesini kontrol edin." },
      { issue: "SOS bildirimi almıyorum", fix: "Ayarlar sekmesinden tarayıcı bildirimlerini etkinleştirin. Tarayıcı sekmesinin açık olduğundan emin olun." },
    ],
  },

  // ── Chinese Simplified (zh-CN) ────────────────────────────────────────────────
  "zh-CN": {
    pageTitle:    "用户手册",
    managerTitle: "管理员手册",
    guardTitle:   "保安手册",
    faqTitle:     "常见问题",
    troubleTitle: "故障排除",
    backLabel:    "返回",
    stepsLabel:   "步骤",
    tipLabel:     "提示",
    manager: [
      {
        id: "register",
        icon: Building2,
        title: "公司注册",
        description: "设置后的第一步是创建管理员账户并注册您的公司。",
        steps: [
          "访问 /manager，点击「首次使用？使用邀请码注册」。",
          "选择用户名和密码，然后输入公司名称。",
          "注册后进入仪表板。从「设置」选项卡复制邀请码。",
          "将此邀请码分享给保安人员，他们注册时需要用到。",
        ],
        tip: "请妥善保管邀请码。如泄露，可在设置中重新生成。",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "添加保安",
        description: "保安人员使用公司邀请码自行注册。",
        steps: [
          "从仪表板的「设置」选项卡复制公司邀请码。",
          "将邀请码发送给保安人员。",
          "保安访问 /guard 并点击「使用公司邀请码注册」。",
          "保安输入专属工号（如 G001）、邀请码、姓名和 PIN 码。",
          "注册后，保安将显示在仪表板的「监控」选项卡中。",
        ],
        tip: "保安工号如 G001 必须唯一。使用简单易记的工号并做好记录。",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "添加巡逻点",
        description: "巡逻点是保安必须在规定间隔内到访的实体位置。",
        steps: [
          "点击左侧菜单中的「巡逻点」。",
          "点击「添加巡逻点」按钮。",
          "输入巡逻点名称和位置描述。",
          "点击「使用当前位置（GPS）」或手动输入 GPS 坐标。",
          "设置允许半径（米）和巡逻间隔。",
          "保存 — QR 码自动生成。",
        ],
        tip: "根据实际位置设置半径。狭窄入口设 50m，开阔区域设 200m。",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "生成和打印 QR 码",
        description: "每个巡逻点都有独特的 QR 码，需张贴在实体位置。",
        steps: [
          "在巡逻点选项卡中点击目标巡逻点。",
          "展开「查看和下载 QR 码」部分。",
          "点击「下载 PNG」或「下载 SVG」获取文件。",
          "点击「打印 QR」直接从浏览器打印。",
          "将打印好的 QR 码张贴在实体巡逻点位置。",
        ],
        tip: "将 QR 码安装在 120–150cm 高度，使用塑料覆膜保护以防风雨侵蚀。",
      },
      {
        id: "logs",
        icon: FileText,
        title: "查看巡逻报告",
        description: "所有保安扫描记录都附带完整 GPS 详情和时间戳。",
        steps: [
          "点击左侧菜单中的「巡逻日志」。",
          "按保安姓名、巡逻点、日期范围或状态筛选。",
          "每条记录显示：保安姓名、巡逻点、扫描时间、GPS 距离、状态。",
          "点击「导出 CSV」下载 Excel 兼容文件。",
        ],
        tip: "状态颜色：绿色 = 在半径内有效扫描，橙色 = 超出允许半径，红色 = 错误。",
      },
      {
        id: "alerts",
        icon: Bell,
        title: "警报和 SOS 管理",
        description: "紧急 SOS 警报和系统通知在此处实时显示。",
        steps: [
          "点击左侧菜单中的「警报」（有新警报时显示红色徽章）。",
          "SOS 警报以红色闪烁动画显示。",
          "点击警报查看详情：GPS 位置、保安姓名、时间戳。",
          "情况处理完毕后点击「确认并关闭警报」。",
        ],
        tip: "在设置中启用浏览器通知，即使选项卡在后台运行也能收到 SOS 警报。",
      },
      {
        id: "map",
        icon: Map,
        title: "实时地图",
        description: "在交互式地图上查看所有在线保安的实时位置。",
        steps: [
          "点击左侧菜单中的「地图」。",
          "蓝色点显示在线保安的当前位置。",
          "绿色点显示已定义的巡逻点位置。",
          "点击任意点查看更多详情（姓名、最后报告时间）。",
        ],
        tip: "地图从 Firestore 实时更新。为获得更高精度，保安需要强力 GPS 信号。",
      },
      {
        id: "settings",
        icon: Settings,
        title: "公司设置",
        description: "在此管理公司信息、邀请码和订阅计划。",
        steps: [
          "点击左侧菜单中的「设置」。",
          "「公司信息」部分显示公司名称和管理员用户名。",
          "在「保安邀请码」部分复制并分享邀请码给新保安。",
          "点击「重新生成」使旧码失效并生成新码。",
          "「套餐」部分显示您当前的订阅级别。",
        ],
        tip: "重新生成邀请码后，尚未注册的保安必须使用新邀请码。",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "保安登录",
        description: "访问保安应用需要您的保安工号和 PIN 码。",
        steps: [
          "访问 /guard。",
          "从管理员处获取您的专属保安工号（如 G001）。",
          "从管理员处获取公司邀请码。",
          "首次使用：点击「注册」并填写您的信息。",
          "注册后，使用保安工号和 PIN 码登录。",
        ],
        tip: "请记住您的 PIN 码 — 找回需要联系管理员。",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "GPS 和相机权限",
        description: "应用需要 GPS 和相机访问权限来扫描巡逻点并验证您的位置。",
        steps: [
          "首次登录时，浏览器会请求「位置」访问权限 — 点击允许。",
          "首次扫描时，浏览器会请求「相机」访问权限 — 点击允许。",
          "如果误点了拒绝：点击浏览器地址栏旁的锁/相机图标，将权限设为允许。",
        ],
        tip: "GPS 必须始终开启。如果看到「GPS 错误」，请确保手机设置中已启用位置服务。",
      },
      {
        id: "scan",
        icon: QrCode,
        title: "扫描巡逻点",
        description: "扫描每个巡逻点的 QR 码以记录您的巡逻访问。",
        steps: [
          "点击屏幕中央的大型「扫描巡逻点」按钮。",
          "相机打开 — 将其对准巡逻点上的 QR 码。",
          "识别 QR 码后，相机关闭，GPS 捕获您的位置。",
          "显示结果：绿色 = 成功，橙色 = 超出范围，红色 = 错误。",
          "结果在 4.5 秒后自动关闭。",
        ],
        tip: "每个巡逻点每 5 分钟只能扫描一次。如果看到「太早」，请稍等片刻。",
      },
      {
        id: "outside",
        icon: AlertTriangle,
        title: "超出范围错误",
        description: "这表示您的 GPS 位置距巡逻点的距离超出了允许半径。",
        steps: [
          "靠近 QR 码 — 您应该站在巡逻点正前方。",
          "等待几秒钟让 GPS 获得更精确的定位。",
          "确保没有墙壁或建筑物遮挡 GPS 信号。",
          "如果问题持续，请联系管理员 — 可能需要增大巡逻点半径。",
        ],
        tip: "GPS 在室外更准确。在密闭空间内可能需要 20–30 秒才能获得精确位置。",
      },
      {
        id: "sos",
        icon: Phone,
        title: "发送 SOS",
        description: "紧急情况下，长按 SOS 按钮立即提醒管理员。",
        steps: [
          "找到主屏幕上的红色 SOS 按钮。",
          "长按 3 秒 — 观察进度条填满。",
          "进度条填满后松开 — 附带您 GPS 位置的 SOS 警报发送给管理员。",
          "管理员立即在仪表板上看到红色闪烁警报。",
        ],
        tip: "SOS 也会在离线时保存。如果离线，连接恢复后将自动发送。",
      },
      {
        id: "logout",
        icon: LogOut,
        title: "退出登录",
        description: "班次结束时请退出登录。",
        steps: [
          "点击屏幕右上角的「退出」按钮。",
          "或打开菜单并选择「退出系统」。",
          "登录屏幕将显示。",
        ],
        tip: "退出后您的巡逻日志仍保留在系统中 — 管理员仍然可以查看。",
      },
    ],
    faq: [
      { q: "应用没有网络也能使用吗？", a: "可以 — 扫描记录离线排队，连接恢复后自动发送。顶部黄色指示器显示等待发送的扫描数量。" },
      { q: "忘记 PIN 码怎么办？", a: "联系公司管理员。管理员可以删除您的保安账户并用新 PIN 重新注册。" },
      { q: "QR 码需要多久更换一次？", a: "QR 码采用密码学保护，无需定期轮换。仅在物理丢失或损坏时更换。" },
      { q: "一台设备可以为多个公司使用吗？", a: "每位保安关联一家公司。要切换公司，请退出登录并使用新公司邀请码重新注册。" },
      { q: "我能添加多少名保安？", a: "基础套餐：最多 5 名保安。专业套餐：最多 20 名。企业套餐：无限制。" },
    ],
    troubleshooting: [
      { issue: "GPS 无法连接 / 精度低", fix: "检查手机设置中是否已启用位置服务。关闭并重新打开浏览器。在室外效果更好。" },
      { issue: "相机无法打开", fix: "在浏览器中点击地址栏旁的锁图标，将相机权限设为允许，然后刷新页面。" },
      { issue: "扫描成功但报告中不显示", fix: "如果您处于离线状态，重新连接后数据将同步。检查屏幕顶部的黄色指示器。" },
      { issue: "Firebase 状态显示「未连接」", fix: "检查您的网络连接，然后刷新页面。如果问题持续，请联系技术支持。" },
      { issue: "仪表板中看不到保安", fix: "确保保安使用正确的公司邀请码注册。在「监控」选项卡中检查是否有活跃会话。" },
      { issue: "未收到 SOS 通知", fix: "在「设置」选项卡中启用浏览器通知。确保浏览器选项卡保持打开状态。" },
    ],
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────
interface HelpPageProps {
  mode: "manager" | "guard";
  onBack: () => void;
}

export default function HelpPage({ mode, onBack }: HelpPageProps) {
  const { lang, dir, isRTL } = useI18n();
  const c = CONTENT[lang] ?? CONTENT.fa;

  const sections = mode === "manager" ? c.manager : c.guard;
  const pageTitle = mode === "manager" ? c.managerTitle : c.guardTitle;

  const [openSection, setOpenSection]  = useState<string | null>(null);
  const [openFaq, setOpenFaq]          = useState<number | null>(null);
  const [openTrouble, setOpenTrouble]  = useState<number | null>(null);
  const [activeTab, setActiveTab]      = useState<"manual" | "faq" | "trouble">("manual");

  const accentColor = mode === "manager" ? "text-primary" : "text-green-400";
  const accentBg    = mode === "manager" ? "bg-primary/10 border-primary/25" : "bg-green-500/10 border-green-500/25";
  const accentFill  = mode === "manager" ? "bg-primary" : "bg-green-500";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-card/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-muted hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className={`w-4 h-4 text-foreground ${isRTL ? "rotate-180" : ""}`} />
        </button>
        <img src={arcGuardLogo} alt="ARC Guard" className="w-7 h-7 object-contain shrink-0"
          style={{ filter: "drop-shadow(0 0 8px rgba(14,165,233,0.4))" }} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold tracking-wide ${accentColor}`}>{pageTitle}</p>
          <p className="text-[10px] text-muted-foreground">ARC Guard v3.0</p>
        </div>
        <div className={`shrink-0 w-8 h-8 rounded-lg ${accentBg} border flex items-center justify-center`}>
          {mode === "manager" ? <Settings className={`w-4 h-4 ${accentColor}`} /> : <Shield className={`w-4 h-4 ${accentColor}`} />}
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex border-b border-border bg-card/80 overflow-x-auto scrollbar-none">
        {([
          { id: "manual",  label: pageTitle,     icon: BookOpen },
          { id: "faq",     label: c.faqTitle,    icon: MessageCircleQuestion },
          { id: "trouble", label: c.troubleTitle, icon: Wrench },
        ] as { id: "manual" | "faq" | "trouble"; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 shrink-0 text-xs font-bold border-b-2 transition-colors ${
              activeTab === id
                ? `border-primary text-primary bg-primary/5`
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">

          {/* Manual tab */}
          {activeTab === "manual" && sections.map((sec) => {
            const isOpen = openSection === sec.id;
            const Icon = sec.icon;
            return (
              <div key={sec.id} className={`rounded-2xl border overflow-hidden transition-colors ${isOpen ? `${accentBg}` : "border-border bg-card"}`}>
                <button
                  onClick={() => setOpenSection(isOpen ? null : sec.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-start hover:bg-accent/40 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${isOpen ? accentBg : "bg-muted border-border"}`}>
                    <Icon className={`w-4 h-4 ${isOpen ? accentColor : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-start">
                    <p className={`text-sm font-bold leading-tight ${isOpen ? accentColor : "text-foreground"}`}>{sec.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">{sec.description}</p>
                  </div>
                  {isOpen
                    ? <ChevronUp className={`w-4 h-4 shrink-0 ${accentColor}`} />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 border-t border-border/50">
                    <p className="text-[12px] text-muted-foreground leading-relaxed pt-3">{sec.description}</p>

                    {/* Steps */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">{c.stepsLabel}</p>
                      <ol className="space-y-2">
                        {sec.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className={`shrink-0 w-5 h-5 rounded-full ${accentFill}/20 border ${mode === "manager" ? "border-primary/30 text-primary" : "border-green-500/30 text-green-400"} flex items-center justify-center text-[10px] font-bold mt-0.5`}>
                              {i + 1}
                            </span>
                            <p className="text-[13px] text-foreground/85 leading-relaxed flex-1">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Tip */}
                    {sec.tip && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-yellow-500/8 border border-yellow-500/20 px-3.5 py-3">
                        <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-yellow-400 mb-0.5">{c.tipLabel}</p>
                          <p className="text-[12px] text-yellow-300/80 leading-relaxed">{sec.tip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* FAQ tab */}
          {activeTab === "faq" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1 pb-1">{c.faqTitle}</p>
              {c.faq.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className={`rounded-xl border overflow-hidden ${isOpen ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-start hover:bg-accent/40 transition-colors"
                    >
                      <MessageCircleQuestion className={`w-4 h-4 shrink-0 mt-0.5 ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`flex-1 text-sm font-semibold leading-snug ${isOpen ? "text-primary" : "text-foreground"}`}>{item.q}</p>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-primary shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-border/50">
                        <p className="text-[13px] text-foreground/80 leading-relaxed pt-3">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Troubleshooting tab */}
          {activeTab === "trouble" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1 pb-1">{c.troubleTitle}</p>
              {c.troubleshooting.map((item, i) => {
                const isOpen = openTrouble === i;
                return (
                  <div key={i} className={`rounded-xl border overflow-hidden ${isOpen ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"}`}>
                    <button
                      onClick={() => setOpenTrouble(isOpen ? null : i)}
                      className="w-full flex items-start gap-3 px-4 py-3.5 text-start hover:bg-accent/40 transition-colors"
                    >
                      <Wrench className={`w-4 h-4 shrink-0 mt-0.5 ${isOpen ? "text-orange-400" : "text-muted-foreground"}`} />
                      <p className={`flex-1 text-sm font-semibold leading-snug ${isOpen ? "text-orange-300" : "text-foreground"}`}>{item.issue}</p>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-border/50">
                        <div className="flex items-start gap-2.5 pt-3">
                          <Lightbulb className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                          <p className="text-[13px] text-foreground/80 leading-relaxed">{item.fix}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pb-6" />
        </div>
      </div>
    </div>
  );
}

