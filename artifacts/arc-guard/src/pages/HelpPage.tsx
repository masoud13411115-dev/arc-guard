import { useState } from "react";
import {
  ArrowLeft, Building2, UserPlus, MapPin, QrCode, FileText,
  Bell, Map, Settings, LogIn, Camera, AlertTriangle, Phone,
  LogOut, ChevronDown, ChevronUp, HelpCircle, BookOpen,
  Lightbulb, Wrench, MessageCircleQuestion, Shield,
  Nfc, WifiOff, Wifi, Database, Radio, Smartphone,
  Navigation, Layers, Zap,
} from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import arcGuardLogo from "/arc-guard-logo.png";

type HelpSection = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  steps: string[];
  tip?: string;
};
type FaqItem     = { q: string; a: string };
type TroubleItem = { issue: string; fix: string };
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

const CONTENT: Record<Lang, HelpData> = {
  // ── Persian ──────────────────────────────────────────────────────────────────
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
          "به بخش Manager بروید و روی «اولین بار است؟ ثبت‌نام» کلیک کنید.",
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
        description: "نگهبانان پس از دریافت کد دعوت شرکت، خودشان ثبت‌نام می‌کنند.",
        steps: [
          "کد دعوت شرکت را از تب «تنظیمات» داشبورد کپی کنید.",
          "کد دعوت را به نگهبان ارسال کنید.",
          "نگهبان به بخش Guard می‌رود و روی «ثبت‌نام با کد دعوت» کلیک می‌کند.",
          "نگهبان: کد اختصاصی (مثلاً G001)، کد دعوت، نام کامل و PIN (حداقل ۶ رقم) را وارد می‌کند.",
          "پس از ثبت‌نام، نگهبان در تب «نظارت» (Monitor) داشبورد ظاهر می‌شود.",
          "در صورت نیاز می‌توانید نگهبان را از تب «نگهبانان» غیرفعال یا حذف کنید.",
        ],
        tip: "کد نگهبان (مثل G001) باید منحصربه‌فرد باشد. از کدهای ساده و قابل به‌یادسپاری استفاده کنید.",
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
          "حالت اسکن را انتخاب کنید (QR، GPS، NFC یا ترکیبی).",
          "برای حالت‌های دارای GPS: روی «موقعیت فعلی» کلیک کنید یا مختصات را دستی وارد کنید.",
          "شعاع مجاز (متر) و بازه گشت را تنظیم کنید.",
          "ذخیره کنید — QR ایستگاه به‌طور خودکار ساخته می‌شود.",
        ],
        tip: "برای حالت‌های فقط QR، فقط NFC یا QR+NFC نیازی به وارد کردن مختصات GPS نیست.",
      },
      {
        id: "scanmodes",
        icon: Layers,
        title: "حالت‌های اسکن (۷ حالت)",
        description: "هر ایستگاه یک حالت اسکن مستقل دارد. این حالت تعیین می‌کند نگهبان چه چیزی باید انجام دهد تا ورود ثبت شود.",
        steps: [
          "QR فقط: نگهبان QR ایستگاه را اسکن می‌کند. GPS چک نمی‌شود. برای داخل ساختمان مناسب است.",
          "GPS فقط: نگهبان دکمه بزرگ سبز را می‌زند. سیستم موقعیت GPS او را با مختصات ایستگاه مقایسه می‌کند. نیازی به دوربین نیست.",
          "NFC فقط: نگهبان گوشی را به تگ NFC نزدیک می‌کند. تأیید فیزیکی بدون QR یا GPS.",
          "QR + GPS: هم QR اسکن شود هم موقعیت GPS در محدوده باشد. بالاترین اطمینان برای فضای باز.",
          "QR + NFC: هم QR اسکن شود هم تگ NFC لمس شود. مناسب برای ورودی‌های کنترل‌شده.",
          "GPS + NFC: هم موقعیت GPS چک شود هم تگ NFC لمس شود. بدون نیاز به دوربین.",
          "همه (ALL): QR + GPS + NFC — بالاترین سطح امنیت برای نقاط حیاتی.",
        ],
        tip: "حالت پیش‌فرض شرکت را از تنظیمات تعیین کنید. ایستگاه‌هایی که حالت خاص دارند حالت شرکت را نادیده می‌گیرند.",
      },
      {
        id: "gpswhen",
        icon: Navigation,
        title: "نیاز به مختصات GPS",
        description: "مختصات GPS (عرض و طول جغرافیایی) فقط برای حالت‌هایی که فاصله را چک می‌کنند اجباری است.",
        steps: [
          "GPS اجباری: GPS فقط، QR+GPS، GPS+NFC، همه (ALL) — این حالت‌ها فاصله نگهبان را از ایستگاه اندازه‌گیری می‌کنند.",
          "GPS اختیاری: QR فقط، NFC فقط، QR+NFC — برای این حالت‌ها مختصات GPS لازم نیست.",
          "اگر حالت دارای GPS انتخاب کردید: دکمه «موقعیت فعلی» را بزنید تا GPS گوشی شما مختصات را پر کند.",
          "یا مختصات را از Google Maps دستی وارد کنید (عرض: lat، طول: lng).",
          "شعاع مجاز را بر اساس اندازه محل تنظیم کنید: ورودی باریک = ۲۵–۵۰ م، فضای باز = ۱۰۰–۲۰۰ م.",
        ],
        tip: "برای دقت بیشتر، هنگام ثبت مختصات درست در محل فیزیکی ایستگاه باشید تا GPS گوشی موقعیت صحیح را ضبط کند.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "ساخت و نصب QR",
        description: "هر ایستگاه یک QR Code اختصاصی دارد که باید در محل فیزیکی نصب شود.",
        steps: [
          "در تب ایستگاه‌ها، روی ایستگاه موردنظر کلیک کنید.",
          "بخش «مشاهده QR Code» را باز کنید.",
          "روی «دانلود PNG» یا «دانلود SVG» کلیک کنید.",
          "برای چاپ مستقیم از مرورگر، دکمه «چاپ QR» را بزنید.",
          "QR چاپ‌شده را در ارتفاع ۱۲۰–۱۵۰ سانتی‌متری در محل فیزیکی نصب کنید.",
          "از لمینت پلاستیکی برای محافظت در برابر رطوبت استفاده کنید.",
        ],
        tip: "QR را در مکانی نصب کنید که نگهبان مجبور شود دقیقاً در محل ایستگاه بایستد — نه از فاصله دور.",
      },
      {
        id: "nfctag",
        icon: Nfc,
        title: "ثبت تگ NFC",
        description: "تگ‌های NFC تأیید فیزیکی حضور نگهبان را بدون دوربین فراهم می‌کنند.",
        steps: [
          "تگ‌های NFC استاندارد NDEF (نوع ۱ تا ۵) را تهیه کنید — در فروشگاه‌های آنلاین موجود است.",
          "ایستگاه را با حالت اسکن دارای NFC (NFC فقط، QR+NFC، GPS+NFC، یا همه) تعریف کنید.",
          "تگ NFC را در محل فیزیکی ایستگاه نصب کنید — پشت تابلو یا داخل جعبه.",
          "هنگام گشت، نگهبان گوشی اندروید را نزدیک تگ می‌کند — سیستم تأیید NFC را ثبت می‌کند.",
          "نیازی به پروگرام کردن تگ نیست — سیستم فقط حضور فیزیکی را تأیید می‌کند.",
        ],
        tip: "NFC از طریق Web NFC API فقط در Chrome اندروید کار می‌کند. iOS و دسکتاپ پشتیبانی نمی‌شوند. دکمه «رد شدن» برای دستگاه‌های ناسازگار همیشه نمایش داده می‌شود.",
      },
      {
        id: "liverecords",
        icon: FileText,
        title: "مشاهده گزارش‌ها و نظارت زنده",
        description: "تمام اسکن‌ها، موقعیت نگهبانان و هشدارها به‌صورت لحظه‌ای قابل مشاهده‌اند.",
        steps: [
          "تب «گزارش گشت»: لیست همه اسکن‌ها با فیلتر نگهبان/ایستگاه/تاریخ/وضعیت. دکمه «CSV» برای خروجی اکسل.",
          "تب «نظارت» (Monitor): جلسه‌های فعال نگهبانان، آخرین GPS، آخرین ایستگاه — همگی در زمان واقعی.",
          "تب «نقشه»: موقعیت لحظه‌ای همه نگهبانان فعال روی نقشه تعاملی.",
          "تب «هشدارها»: SOS اضطراری و هشدارهای سیستم. نشانگر قرمز = هشدار خوانده‌نشده.",
          "برای هر اسکن اطلاعات نمایش داده می‌شود: نگهبان، ایستگاه، زمان، فاصله GPS، حالت اسکن، وضعیت.",
          "وضعیت‌ها: سبز = موفق در محدوده، نارنجی = خارج از شعاع، قرمز = خطا.",
        ],
        tip: "اعلان مرورگر را در تب تنظیمات فعال کنید تا SOS حتی وقتی برگه مرورگر بسته است به شما برسد.",
      },
      {
        id: "offline",
        icon: Wifi,
        title: "همگام‌سازی و حالت ذخیره‌سازی",
        description: "سیستم سه حالت ذخیره‌سازی دارد. حالت مناسب را از تنظیمات انتخاب کنید.",
        steps: [
          "Firebase (پیش‌فرض): داده‌ها در Firestore ابری ذخیره می‌شوند. نیاز به اینترنت دارد. بهترین گزینه برای شرکت‌های معمولی.",
          "IndexedDB (محلی): همه داده‌ها روی دستگاه ذخیره می‌شوند. بدون نیاز به اینترنت. برای محیط‌های بدون شبکه.",
          "سرور محلی (LAN): داده‌ها روی سرور شبکه داخلی ذخیره می‌شوند. در تنظیمات آدرس IP سرور را وارد کنید.",
          "حالت آفلاین اضطراری: حتی در Firebase، اگر اینترنت قطع شود اسکن‌ها در صف ذخیره می‌شوند.",
          "نشانگر وضعیت در بالای صفحه: سبز = متصل، زرد = آفلاین، تعداد = اسکن‌های در صف.",
          "پس از اتصال مجدد، اسکن‌های صف خودکار همگام می‌شوند.",
        ],
        tip: "تب «پشتیبان‌گیری» (Backup) را فعال کنید تا هر ۶ یا ۲۴ ساعت یک‌بار نسخه JSON/ZIP از داده‌ها دریافت کنید.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "ورود با کد دعوت",
        description: "برای اولین بار باید با کد دعوت شرکت ثبت‌نام کنید.",
        steps: [
          "کد نگهبان اختصاصی (مثلاً G001) و کد دعوت شرکت را از مدیرتان دریافت کنید.",
          "به بخش Guard بروید و روی «ثبت‌نام با کد دعوت» کلیک کنید.",
          "کد نگهبان، کد دعوت، نام کامل و یک PIN (حداقل ۶ رقم) وارد کنید.",
          "پس از ثبت‌نام، با کد نگهبان و PIN خود وارد شوید.",
          "بعد از ورود موفق، صفحه گشت نمایش داده می‌شود و شما آماده کار هستید.",
        ],
        tip: "PIN خود را حفظ کنید. برای بازیابی باید با مدیر تماس بگیرید — مدیر می‌تواند حساب را حذف و مجدداً ثبت‌نام کند.",
      },
      {
        id: "gpsonly",
        icon: Navigation,
        title: "ورود GPS فقط (بدون دوربین)",
        description: "اگر ایستگاه در حالت «GPS فقط» تنظیم شده باشد، دوربین باز نمی‌شود — فقط موقعیت GPS شما چک می‌شود.",
        steps: [
          "وقتی همه ایستگاه‌ها GPS-فقط باشند، یک دکمه بزرگ سبز (مانند دکمه QR) در صفحه نمایش می‌بینید.",
          "دکمه سبز را بزنید — سیستم موقعیت GPS شما را می‌گیرد (بدون باز شدن دوربین).",
          "پس از چند ثانیه نتیجه نمایش داده می‌شود: سبز = در محدوده ✓، نارنجی = خارج از شعاع.",
          "اگر چند ایستگاه GPS-فقط وجود دارد، در لیست پایین روی دکمه کنار هر ایستگاه بزنید.",
          "GPS به‌طور خودکار در پس‌زمینه همیشه فعال است — نیازی به رفرش دستی GPS نیست.",
        ],
        tip: "در فضای باز GPS خیلی سریع‌تر است. اگر داخل ساختمان هستید چند ثانیه صبر کنید تا GPS دقیق شود.",
      },
      {
        id: "qrscan",
        icon: QrCode,
        title: "اسکن QR ایستگاه",
        description: "برای ایستگاه‌های دارای QR، دوربین گوشی را روی QR نصب‌شده در محل نگه دارید.",
        steps: [
          "روی دکمه بزرگ آبی «اسکن ایستگاه» در مرکز صفحه بزنید.",
          "دوربین باز می‌شود — QR code روی ایستگاه را در مرکز قاب قرار دهید.",
          "پس از شناسایی QR، دوربین بسته می‌شود.",
          "اگر حالت QR+GPS است: سیستم موقعیت GPS شما را هم بررسی می‌کند.",
          "اگر حالت QR+NFC است: پس از QR یک صفحه «تگ NFC را لمس کنید» نمایش داده می‌شود.",
          "نتیجه نهایی: سبز = موفق، نارنجی = خارج از محدوده، قرمز = خطا.",
        ],
        tip: "هر ایستگاه یک بار در هر ۵ دقیقه قابل اسکن است. اگر 'زود است' می‌بینید کمی صبر کنید.",
      },
      {
        id: "nfcscan",
        icon: Nfc,
        title: "اسکن NFC",
        description: "برای ایستگاه‌های دارای NFC، گوشی را به تگ NFC نصب‌شده در محل نزدیک کنید.",
        steps: [
          "مطمئن شوید NFC در تنظیمات گوشی اندروید فعال است (تنظیمات ← اتصالات ← NFC).",
          "مطمئن شوید از Chrome در اندروید استفاده می‌کنید (NFC در iOS یا سایر مرورگرها کار نمی‌کند).",
          "صفحه بنفش «تگ NFC را لمس کنید» نمایش داده می‌شود.",
          "پشت گوشی را به تگ NFC نصب‌شده در محل ایستگاه نزدیک کنید (۱–۳ سانتی‌متر).",
          "پس از شناسایی، نتیجه نمایش داده می‌شود.",
          "اگر گوشی شما NFC ندارد یا مرورگر پشتیبانی نمی‌کند، دکمه «رد شدن» نمایش داده می‌شود.",
        ],
        tip: "برای بهترین نتیجه، پشت وسط گوشی (معمولاً بالای دکمه‌ها) را به تگ برسانید. تگ NFC از فاصله بیشتر از ۳ سانتی‌متر کار نمی‌کند.",
      },
      {
        id: "gpsoff",
        icon: AlertTriangle,
        title: "GPS خاموش یا خارج از محدوده",
        description: "اگر پیام GPS خطا یا خارج از محدوده دریافت کردید این مراحل را دنبال کنید.",
        steps: [
          "اگر «GPS خطا» می‌بینید: تنظیمات گوشی ← موقعیت مکانی ← مطمئن شوید فعال است.",
          "در مرورگر روی آیکون قفل کنار آدرس کلیک کنید و مجوز «موقعیت مکانی» را «اجازه» کنید.",
          "مرورگر را ببندید و دوباره باز کنید، سپس دوباره امتحان کنید.",
          "اگر «خارج از محدوده» می‌بینید: درست کنار تگ/QR ایستگاه بایستید — نه از فاصله دور.",
          "در فضای بسته ۲۰–۳۰ ثانیه صبر کنید تا GPS دقیق‌تر شود.",
          "اگر مشکل ادامه دارد با مدیر تماس بگیرید — شاید شعاع ایستگاه باید بیشتر شود.",
        ],
        tip: "GPS واچ در پس‌زمینه همیشه فعال است. اگر نشانگر GPS در بالای صفحه سبز باشد موقعیت دریافت شده است.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "مجوز دوربین، GPS و NFC",
        description: "اپ برای عملکرد صحیح به دسترسی دوربین (QR)، موقعیت مکانی (GPS) و NFC نیاز دارد.",
        steps: [
          "GPS: هنگام اولین باز شدن اپ، مرورگر اجازه «موقعیت مکانی» می‌خواهد — «اجازه» را بزنید.",
          "دوربین: هنگام اولین اسکن QR، مرورگر اجازه «دوربین» می‌خواهد — «اجازه» را بزنید.",
          "NFC: هنگام اولین لمس تگ NFC، مرورگر اجازه «NFC» می‌خواهد — «اجازه» را بزنید.",
          "اگر اجازه را اشتباه رد کردید: آدرس اپ را در Chrome باز کنید ← آیکون قفل ← مجوزها ← هر سه را «اجازه» کنید.",
          "اگر دوربین باز نمی‌شود: از منوی کروم (سه‌نقطه) ← تنظیمات ← مجوز سایت ← دوربین ← سایت را از «مسدود» خارج کنید.",
          "اگر NFC اصلاً نمایش داده نمی‌شود: دستگاه iOS یا مرورگر غیر از Chrome روی اندروید است — دکمه رد شدن را بزنید.",
        ],
        tip: "نصب PWA (افزودن به صفحه اصلی) تجربه بهتری می‌دهد — اپ تمام‌صفحه باز می‌شود و مجوزها سریع‌تر اعمال می‌شوند.",
      },
      {
        id: "offlineguard",
        icon: WifiOff,
        title: "حالت آفلاین و همگام‌سازی بعدی",
        description: "اگر اینترنت قطع شود اسکن‌ها ذخیره می‌شوند و پس از اتصال مجدد ارسال خواهند شد.",
        steps: [
          "نشانگر زرد «آفلاین» در بالای صفحه نشان می‌دهد اتصال قطع است.",
          "عدد کنار نشانگر = تعداد اسکن‌های در صف انتظار ارسال.",
          "به اسکن ادامه دهید — همه اسکن‌ها در حافظه دستگاه ذخیره می‌شوند.",
          "SOS هم در حالت آفلاین ذخیره می‌شود و به محض اتصال ارسال می‌گردد.",
          "وقتی اینترنت برگشت، همگام‌سازی خودکار در چند ثانیه انجام می‌شود.",
          "می‌توانید دکمه «ارسال» کنار نشانگر را برای همگام‌سازی دستی بزنید.",
        ],
        tip: "ایستگاه‌ها در حافظه محلی کش می‌شوند — حتی بدون اینترنت می‌توانید QR اسکن کنید و سیستم ایستگاه را پیدا می‌کند.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "ارسال SOS اضطراری",
        description: "در شرایط اضطراری، دکمه SOS را برای اطلاع‌رسانی فوری به مدیر نگه دارید.",
        steps: [
          "دکمه SOS قرمزرنگ را در صفحه اصلی پیدا کنید.",
          "دکمه را ۳ ثانیه نگه دارید — نوار پیشرفت پر می‌شود.",
          "وقتی نوار کامل شد دست بردارید — هشدار SOS با موقعیت GPS شما بلافاصله ارسال می‌شود.",
          "مدیر در داشبورد خود هشدار قرمز چشمک‌زن را فوری می‌بیند.",
          "در حالت آفلاین، SOS ذخیره و به محض اتصال ارسال می‌شود.",
        ],
        tip: "SOS را فقط در موارد واقعاً اضطراری ارسال کنید. هر SOS در سیستم ثبت دائمی می‌شود.",
      },
    ],
    faq: [
      { q: "آیا اپ بدون اینترنت کار می‌کند؟", a: "بله — اسکن‌ها در حالت آفلاین در صف ذخیره می‌شوند و به محض اتصال مجدد ارسال می‌گردند. نشانگر زرد بالای صفحه تعداد اسکن‌های در صف را نشان می‌دهد." },
      { q: "تفاوت حالت GPS فقط با QR+GPS چیست؟", a: "در GPS فقط دوربین اصلاً باز نمی‌شود — فقط یک تپ روی دکمه سبز کافی است. در QR+GPS ابتدا QR اسکن می‌شود، سپس موقعیت GPS هم چک می‌شود. برای ایستگاه‌های بیرونی که نگهبان باید کاملاً در محل باشد، GPS فقط ساده‌تر و سریع‌تر است." },
      { q: "NFC روی گوشی من کار نمی‌کند؟", a: "NFC فقط در Chrome اندروید پشتیبانی می‌شود. iOS و مرورگرهای دیگر NFC ندارند. دکمه «رد شدن» همیشه نمایش داده می‌شود تا گارد بتواند بدون NFC ادامه دهد." },
      { q: "اگر PIN خود را فراموش کردم چه کار کنم؟", a: "با مدیر شرکت تماس بگیرید. مدیر می‌تواند حساب نگهبان را حذف و دوباره ثبت‌نام کند با PIN جدید." },
      { q: "چند ایستگاه می‌توانم با حالت‌های مختلف تعریف کنم؟", a: "بله — هر ایستگاه حالت اسکن مستقل دارد. مثلاً ایستگاه ۱ = GPS فقط، ایستگاه ۲ = QR+GPS، ایستگاه ۳ = NFC فقط." },
      { q: "آیا می‌توانم از یک گوشی با چند شرکت کار کنم؟", a: "هر نگهبان به یک شرکت خاص متصل است. برای تغییر شرکت باید خارج شده و با اطلاعات جدید ثبت‌نام کنید." },
    ],
    troubleshooting: [
      { issue: "GPS وصل نمی‌شود یا دقت پایین دارد", fix: "تنظیمات گوشی ← موقعیت مکانی را فعال کنید. مرورگر را ببندید و دوباره باز کنید. در فضای باز یا کنار پنجره امتحان کنید." },
      { issue: "دوربین باز نمی‌شود هنگام اسکن QR", fix: "در Chrome روی آیکون قفل کنار آدرس کلیک کنید، دسترسی دوربین را «اجازه» کنید و صفحه را رفرش کنید." },
      { issue: "NFC شناسایی نمی‌شود", fix: "مطمئن شوید NFC در تنظیمات اندروید فعال است. پشت گوشی را (نه جلو) به تگ نزدیک کنید. Chrome اندروید داشته باشید." },
      { issue: "پیام «خارج از محدوده» دریافت می‌کنم ولی در محل هستم", fix: "با مدیر تماس بگیرید تا شعاع ایستگاه را افزایش دهد. در فضای بسته GPS ممکن است دچار خطای ۲۰–۵۰ متری شود." },
      { issue: "اسکن موفق است ولی در گزارش نمایش داده نمی‌شود", fix: "اگر در حالت آفلاین بودید، نشانگر زرد را ببینید — پس از اتصال خودکار همگام می‌شود. دکمه ارسال را بزنید." },
      { issue: "نگهبان در داشبورد دیده نمی‌شود", fix: "نگهبان باید با کد دعوت صحیح ثبت‌نام کرده باشد. در تب Monitor بررسی کنید. اگر غیرفعال است از تب نگهبانان فعال کنید." },
      { issue: "وضعیت Firebase: متصل نیست", fix: "اتصال اینترنت را بررسی کنید. صفحه را رفرش کنید. یا از حالت IndexedDB محلی استفاده کنید." },
    ],
  },

  // ── English ───────────────────────────────────────────────────────────────────
  en: {
    pageTitle:    "User Guide",
    managerTitle: "Manager Guide",
    guardTitle:   "Guard Guide",
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
          "Go to the Manager section and click 'First time? Register'.",
          "Choose a username and password, then enter your company name.",
          "After registration, you'll see the Dashboard. Copy the invite code from the Settings tab.",
          "Share this invite code with your guards — they'll need it to register.",
        ],
        tip: "Keep the invite code confidential. Regenerate it anytime from Settings if needed.",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "Adding Guards",
        description: "Guards register themselves using your company's invite code.",
        steps: [
          "Copy your company invite code from the Settings tab in the Dashboard.",
          "Send the invite code to the guard.",
          "The guard goes to the Guard section and clicks 'Register with invite code'.",
          "The guard enters their unique guard code (e.g. G001), the invite code, full name, and a PIN (min 6 digits).",
          "After registration, the guard appears in the Monitor tab of your Dashboard.",
          "You can deactivate or remove guards from the Guards tab if needed.",
        ],
        tip: "Guard codes like G001 must be unique. Keep simple, memorable codes and maintain a record.",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "Adding Checkpoints",
        description: "Checkpoints are physical locations that guards must visit at set intervals.",
        steps: [
          "Click 'Checkpoints' in the left menu.",
          "Click the 'Add Checkpoint' button.",
          "Enter the checkpoint name and a location description.",
          "Select the scan mode (QR, GPS, NFC, or a combination).",
          "For GPS-containing modes: click 'Use Current Location' or enter coordinates manually.",
          "Set the allowed radius (meters) and patrol interval.",
          "Save — the QR code is generated automatically.",
        ],
        tip: "For QR-only, NFC-only, or QR+NFC modes you do not need to enter GPS coordinates.",
      },
      {
        id: "scanmodes",
        icon: Layers,
        title: "Scan Modes (7 Types)",
        description: "Each checkpoint has an independent scan mode. The mode determines what a guard must do to log a check-in.",
        steps: [
          "QR only: Guard scans the QR code. GPS distance is NOT checked. Best for indoor locations.",
          "GPS only: Guard taps the big green button. System compares GPS position against checkpoint coordinates. No camera needed.",
          "NFC only: Guard taps phone to NFC tag at checkpoint. Physical verification without QR or GPS.",
          "QR + GPS: QR scanned AND GPS position must be within radius. Highest confidence for outdoor sites.",
          "QR + NFC: QR scanned AND NFC tag tapped. Best for controlled entry points.",
          "GPS + NFC: GPS position checked AND NFC tag tapped. No camera needed.",
          "ALL: QR + GPS + NFC — maximum security for critical checkpoints.",
        ],
        tip: "Set the company-wide default mode in Settings. Checkpoints with their own scan mode override the company default.",
      },
      {
        id: "gpswhen",
        icon: Navigation,
        title: "When GPS Coordinates Are Required",
        description: "GPS coordinates (latitude/longitude) are only required for modes that check distance.",
        steps: [
          "GPS required: GPS only, QR+GPS, GPS+NFC, ALL — these modes measure guard distance from the checkpoint.",
          "GPS optional: QR only, NFC only, QR+NFC — GPS coordinates are not needed for these modes.",
          "For GPS modes: tap 'Use Current Location' to auto-fill from your device GPS.",
          "Or enter coordinates manually from Google Maps (lat = latitude, lng = longitude).",
          "Set the allowed radius based on location size: narrow entry = 25–50 m, open area = 100–200 m.",
        ],
        tip: "For best accuracy, stand at the exact physical checkpoint when capturing GPS so your phone records the correct position.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "QR Code Creation & Installation",
        description: "Each checkpoint has a unique QR code that must be physically installed at the location.",
        steps: [
          "In the Checkpoints tab, click the checkpoint you want.",
          "Expand the 'View QR Code' section.",
          "Click 'Download PNG' or 'Download SVG' for a file.",
          "Click 'Print QR' to print directly from the browser.",
          "Install the QR at 120–150 cm height at the physical checkpoint location.",
          "Use plastic laminate to protect it from weather.",
        ],
        tip: "Install the QR so the guard must stand exactly at the checkpoint — not scan from a distance away.",
      },
      {
        id: "nfctag",
        icon: Nfc,
        title: "Registering NFC Tags",
        description: "NFC tags provide physical presence verification without a camera.",
        steps: [
          "Purchase standard NDEF NFC tags (Type 1–5) — widely available online.",
          "Define a checkpoint with an NFC-containing scan mode (NFC only, QR+NFC, GPS+NFC, or ALL).",
          "Attach the NFC sticker at the physical checkpoint — behind a sign or inside an enclosure.",
          "During patrol, the guard holds their Android phone near the tag — the system records NFC verification.",
          "No tag programming needed — the system only confirms physical presence, not a specific tag ID.",
        ],
        tip: "NFC uses the Web NFC API and only works in Chrome on Android. iOS and desktop browsers are not supported. A bypass button is always shown for incompatible devices.",
      },
      {
        id: "liverecords",
        icon: FileText,
        title: "Live Records & Monitoring",
        description: "All scans, guard positions, and alerts are visible in real time.",
        steps: [
          "Patrol Logs tab: full list of all scans with filters for guard/checkpoint/date/status. CSV export button included.",
          "Monitor tab: active guard sessions, last known GPS, last checkpoint — all in real time.",
          "Map tab: live positions of all active guards on an interactive map.",
          "Alerts tab: urgent SOS alerts and system warnings. Red badge = unread alerts.",
          "Each scan record shows: guard, checkpoint, time, GPS distance, scan mode, and status.",
          "Status colours: green = valid within radius, orange = outside radius, red = error.",
        ],
        tip: "Enable browser notifications in the Settings tab so SOS alerts reach you even when the browser tab is in the background.",
      },
      {
        id: "offline",
        icon: Wifi,
        title: "Sync & Storage Modes",
        description: "The system has three storage modes. Choose the right one from Settings.",
        steps: [
          "Firebase (default): data stored in cloud Firestore. Requires internet. Best for most companies.",
          "IndexedDB (local): all data stored on the device. No internet needed. Use for offline-only environments.",
          "Local Server (LAN): data stored on your company's internal network server. Enter the server IP in Settings.",
          "Emergency offline: even in Firebase mode, if internet drops, scans queue automatically.",
          "Status indicator at top: green = connected, yellow = offline, number = queued scans.",
          "After reconnecting, queued scans sync automatically within a few seconds.",
        ],
        tip: "Enable the Backup tab to auto-download a JSON/ZIP snapshot of all your data every 6 or 24 hours.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "Joining with Invite Code",
        description: "For your first login you need to register with the company's invite code.",
        steps: [
          "Get your unique guard code (e.g. G001) and the company invite code from your manager.",
          "Go to the Guard section and click 'Register with invite code'.",
          "Enter your guard code, invite code, full name, and a PIN (min 6 digits).",
          "After registration, sign in with your guard code and PIN.",
          "The patrol screen appears and you are ready to start.",
        ],
        tip: "Memorise your PIN. To recover it you'll need to contact your manager — they can delete and re-register your account.",
      },
      {
        id: "gpsonly",
        icon: Navigation,
        title: "GPS-Only Check-In (No Camera)",
        description: "If a checkpoint is set to GPS-only mode, the camera does not open — only your GPS position is checked.",
        steps: [
          "When all checkpoints are GPS-only, a large green button (matching the QR button size) appears on screen.",
          "Tap the green button — the system gets your GPS position (no camera opens).",
          "After a few seconds a result is shown: green = within radius ✓, orange = outside radius.",
          "If there are multiple GPS-only checkpoints, tap the button next to each one in the list.",
          "GPS runs continuously in the background — no need to refresh manually.",
        ],
        tip: "GPS works best outdoors. Inside a building wait 20–30 seconds for accuracy to improve before tapping.",
      },
      {
        id: "qrscan",
        icon: QrCode,
        title: "Scanning a QR Checkpoint",
        description: "For checkpoints with QR, hold your phone camera over the QR installed at the location.",
        steps: [
          "Tap the large blue 'Scan Checkpoint' button in the centre of the screen.",
          "The camera opens — hold the QR code in the centre of the frame.",
          "Once the QR is recognised the camera closes automatically.",
          "If the mode is QR+GPS: your GPS position is also checked.",
          "If the mode is QR+NFC: a 'Tap NFC tag' screen appears next.",
          "Final result: green = success, orange = outside radius, red = error.",
        ],
        tip: "Each checkpoint can only be scanned once every 5 minutes. If you see 'Too soon' — wait a moment.",
      },
      {
        id: "nfcscan",
        icon: Nfc,
        title: "Scanning an NFC Tag",
        description: "For checkpoints with NFC, hold your phone close to the NFC sticker installed at the location.",
        steps: [
          "Make sure NFC is enabled in your Android settings (Settings → Connections → NFC).",
          "Make sure you are using Chrome on Android (NFC does not work on iOS or other browsers).",
          "A purple 'Tap NFC Tag' screen appears on your phone.",
          "Hold the back of your phone close to the NFC sticker (1–3 cm) at the checkpoint.",
          "Once detected, the result is shown.",
          "If your phone has no NFC or the browser doesn't support it, a bypass button is shown.",
        ],
        tip: "Hold the centre-back of your phone to the tag. NFC does not work from more than 3 cm away.",
      },
      {
        id: "gpsoff",
        icon: AlertTriangle,
        title: "GPS Off or Outside Radius",
        description: "If you see a GPS error or outside-radius message, follow these steps.",
        steps: [
          "GPS error: go to phone Settings → Location and make sure it is enabled.",
          "In Chrome, tap the lock icon next to the address bar and set Location permission to Allow.",
          "Close the browser and reopen it, then try again.",
          "Outside radius: stand directly in front of the checkpoint QR/tag — not further away.",
          "Indoors, wait 20–30 seconds for GPS accuracy to improve.",
          "If the problem persists, contact your manager — the checkpoint radius may need to be increased.",
        ],
        tip: "The GPS watch runs in the background continuously. If the GPS indicator at the top of the screen is green, a position has been acquired.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "Camera, GPS, and NFC Permissions",
        description: "The app needs camera (QR scanning), location (GPS), and NFC access to work correctly.",
        steps: [
          "GPS: on first launch the browser asks for Location permission — tap Allow.",
          "Camera: on first QR scan the browser asks for Camera permission — tap Allow.",
          "NFC: on first NFC tap the browser asks for NFC permission — tap Allow.",
          "If you accidentally denied permission: open the app URL in Chrome, tap the lock icon, go to Permissions, and set each to Allow.",
          "If camera still doesn't open: Chrome menu (⋮) → Settings → Site settings → Camera → remove the site from Blocked.",
          "If NFC never appears: your device is iOS or uses a non-Chrome browser — use the bypass button.",
        ],
        tip: "Installing the PWA (Add to Home Screen) gives a better experience — the app opens full screen and permissions apply faster.",
      },
      {
        id: "offlineguard",
        icon: WifiOff,
        title: "Offline Mode & Sync Later",
        description: "If the internet drops, scans are saved locally and sent automatically when you reconnect.",
        steps: [
          "A yellow 'Offline' indicator appears at the top of the screen when disconnected.",
          "The number next to it = scans waiting to be sent.",
          "Continue scanning normally — all scans are saved in device memory.",
          "SOS is also saved offline and sent as soon as connection is restored.",
          "When internet returns, auto-sync runs within a few seconds.",
          "You can also tap the 'Send' button next to the indicator to sync manually.",
        ],
        tip: "Checkpoints are cached locally — you can still scan QR codes offline and the system will find the checkpoint.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "Sending an SOS Alert",
        description: "In an emergency, hold the SOS button to immediately notify your manager.",
        steps: [
          "Find the red SOS button on the main patrol screen.",
          "Hold it for 3 seconds — watch the progress bar fill.",
          "Release when the bar is full — the SOS alert with your GPS location is sent immediately.",
          "Your manager sees a red flashing alert on their Dashboard instantly.",
          "SOS is also saved offline and sent when internet is available.",
        ],
        tip: "Only send SOS in genuine emergencies. Every SOS is permanently logged in the system.",
      },
    ],
    faq: [
      { q: "Does the app work without internet?", a: "Yes — scans queue offline and are sent automatically when you reconnect. The yellow indicator at the top shows how many are waiting." },
      { q: "What is the difference between GPS-only and QR+GPS?", a: "GPS-only requires no camera — a single tap on the green button is enough. QR+GPS first scans the QR code then also checks GPS distance. GPS-only is simpler and faster for outdoor patrol points." },
      { q: "NFC is not working on my phone?", a: "NFC only works in Chrome on Android. iOS and other browsers are not supported. A bypass button is always shown so guards can continue without NFC." },
      { q: "I forgot my PIN — what do I do?", a: "Contact your company manager. They can delete and re-register your guard account with a new PIN." },
      { q: "Can I set different scan modes for different checkpoints?", a: "Yes — each checkpoint has its own independent scan mode. For example: checkpoint 1 = GPS only, checkpoint 2 = QR+GPS, checkpoint 3 = NFC only." },
      { q: "Can one phone be used with multiple companies?", a: "Each guard account is tied to one company. To switch companies, log out and re-register with the new company's invite code." },
    ],
    troubleshooting: [
      { issue: "GPS won't connect / low accuracy", fix: "Enable Location in phone Settings. Close and reopen the browser. Try outdoors or near a window." },
      { issue: "Camera doesn't open for QR scan", fix: "In Chrome, tap the lock icon next to the address bar, set Camera to Allow, then refresh the page." },
      { issue: "NFC tag not detected", fix: "Make sure NFC is enabled in Android settings. Hold the back of your phone (not front) to the tag. Use Chrome on Android." },
      { issue: "'Outside radius' even when at the checkpoint", fix: "Contact your manager to increase the checkpoint radius. Indoor GPS can have 20–50 m of error." },
      { issue: "Scan succeeded but not showing in reports", fix: "If you were offline, check the yellow indicator — it will sync when you reconnect. Tap the Send button to force sync." },
      { issue: "Guard not visible in Dashboard", fix: "Ensure the guard registered with the correct invite code. Check the Monitor tab. If deactivated, re-enable from the Guards tab." },
      { issue: "Firebase status: not connected", fix: "Check your internet connection, then refresh the page. Alternatively switch to IndexedDB local storage mode in Settings." },
    ],
  },

  // ── Turkish ───────────────────────────────────────────────────────────────────
  tr: {
    pageTitle:    "Kullanım Kılavuzu",
    managerTitle: "Yönetici Kılavuzu",
    guardTitle:   "Güvenlik Görevlisi Kılavuzu",
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
        description: "Kurulumdan sonra ilk adım yönetici hesabı oluşturmak ve şirket bilgilerini kaydetmektir.",
        steps: [
          "Yönetici bölümüne gidin ve 'İlk kez mi? Kayıt ol' seçeneğine tıklayın.",
          "Kullanıcı adı ve şifre seçin, şirket adını girin.",
          "Kayıttan sonra Kontrol Paneli görünür. Davet kodunu Ayarlar sekmesinden kopyalayın.",
          "Bu davet kodunu güvenlik görevlilerinizle paylaşın.",
        ],
        tip: "Davet kodunu gizli tutun. Gerekirse Ayarlar'dan yeni kod oluşturun.",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "Güvenlik Görevlisi Ekleme",
        description: "Görevliler şirket davet koduyla kendileri kayıt olur.",
        steps: [
          "Kontrol Paneli'nden Ayarlar sekmesini açın ve davet kodunu kopyalayın.",
          "Davet kodunu görevliye gönderin.",
          "Görevli Guard bölümüne giderek 'Davet koduyla kayıt ol' seçeneğine tıklar.",
          "Görevli: benzersiz kod (örn. G001), davet kodu, tam ad ve PIN (en az 6 hane) girer.",
          "Kayıttan sonra görevli Kontrol Paneli'nin İzleme sekmesinde görünür.",
        ],
        tip: "Görevli kodları (G001 gibi) benzersiz olmalıdır. Basit ve akılda kalıcı kodlar kullanın.",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "Kontrol Noktası Ekleme",
        description: "Kontrol noktaları, görevlilerin belirli aralıklarla ziyaret etmesi gereken fiziksel konumlardır.",
        steps: [
          "Sol menüden 'Kontrol Noktaları'na tıklayın.",
          "'Kontrol Noktası Ekle' butonuna basın.",
          "Kontrol noktası adı ve konum açıklamasını girin.",
          "Tarama modunu seçin (QR, GPS, NFC veya kombinasyon).",
          "GPS içeren modlar için: 'Mevcut Konumu Kullan'a tıklayın veya koordinatları manuel girin.",
          "İzin verilen yarıçap (metre) ve devriye aralığını ayarlayın.",
          "Kaydedin — QR kodu otomatik oluşturulur.",
        ],
        tip: "Sadece QR, sadece NFC veya QR+NFC modlarında GPS koordinatı gerekmez.",
      },
      {
        id: "scanmodes",
        icon: Layers,
        title: "Tarama Modları (7 Tür)",
        description: "Her kontrol noktasının bağımsız bir tarama modu vardır.",
        steps: [
          "Yalnızca QR: Görevli QR kodunu tarar. GPS kontrol edilmez. İç mekan için idealdir.",
          "Yalnızca GPS: Görevli büyük yeşil butona basar. Sistem GPS konumunu kontrol eder. Kamera gerekmez.",
          "Yalnızca NFC: Görevli telefonu NFC etiketine yaklaştırır.",
          "QR + GPS: Hem QR taranır hem GPS konumu yarıçap içinde olmalıdır.",
          "QR + NFC: Hem QR taranır hem NFC etiketi dokunulur.",
          "GPS + NFC: Hem GPS kontrol edilir hem NFC etiketine dokunulur.",
          "Tümü (ALL): QR + GPS + NFC — kritik noktalar için maksimum güvenlik.",
        ],
        tip: "Şirket geneli varsayılan modu Ayarlar'dan belirleyin. Kendi modu olan kontrol noktaları bu ayarı geçersiz kılar.",
      },
      {
        id: "gpswhen",
        icon: Navigation,
        title: "GPS Koordinatları Ne Zaman Gereklidir?",
        description: "GPS koordinatları yalnızca mesafe kontrol eden modlarda zorunludur.",
        steps: [
          "GPS gerekli: Yalnızca GPS, QR+GPS, GPS+NFC, Tümü — bu modlar mesafeyi ölçer.",
          "GPS isteğe bağlı: Yalnızca QR, Yalnızca NFC, QR+NFC — koordinat gerekmez.",
          "GPS modu için: 'Mevcut Konumu Kullan'a tıklayarak cihaz GPS'inden otomatik doldurun.",
          "Yarıçapı konuma göre ayarlayın: dar giriş = 25–50 m, açık alan = 100–200 m.",
        ],
        tip: "En iyi doğruluk için GPS kaydederken fiziksel kontrol noktasında olun.",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "QR Kodu Oluşturma ve Kurulum",
        description: "Her kontrol noktasının fiziksel konuma kurulması gereken benzersiz bir QR kodu vardır.",
        steps: [
          "Kontrol Noktaları sekmesinde ilgili noktaya tıklayın.",
          "'QR Kodunu Görüntüle' bölümünü açın.",
          "'PNG İndir' veya 'SVG İndir'e tıklayın.",
          "Doğrudan tarayıcıdan yazdırmak için 'QR Yazdır'a basın.",
          "QR'yi 120–150 cm yüksekliğe fiziksel konuma yerleştirin.",
        ],
        tip: "QR'yi görevlinin tam olarak kontrol noktasında durması gereken yere koyun.",
      },
      {
        id: "nfctag",
        icon: Nfc,
        title: "NFC Etiketi Kaydı",
        description: "NFC etiketleri kamera olmadan fiziksel varlık doğrulaması sağlar.",
        steps: [
          "Standart NDEF NFC etiketleri (Tip 1–5) temin edin.",
          "NFC içeren tarama moduyla kontrol noktası oluşturun.",
          "NFC etiketini fiziksel konuma yapıştırın.",
          "Devriyede görevli Android telefonu etikete yaklaştırır — sistem NFC doğrulamasını kaydeder.",
          "Etiket programlaması gerekmez — sistem yalnızca fiziksel varlığı doğrular.",
        ],
        tip: "NFC yalnızca Android'de Chrome'da çalışır. iOS ve diğer tarayıcılar desteklenmez.",
      },
      {
        id: "liverecords",
        icon: FileText,
        title: "Canlı Kayıtlar ve İzleme",
        description: "Tüm taramalar, görevli konumları ve uyarılar gerçek zamanlı görüntülenebilir.",
        steps: [
          "Devriye Günlükleri: filtrelerle tüm taramaların listesi. CSV dışa aktarma butonu mevcut.",
          "İzleme sekmesi: aktif görevli oturumları, son GPS, son kontrol noktası.",
          "Harita sekmesi: tüm aktif görevlilerin canlı konumları.",
          "Uyarılar sekmesi: acil SOS ve sistem uyarıları.",
        ],
        tip: "SOS uyarılarını arkaplanda almak için Ayarlar sekmesinden tarayıcı bildirimlerini etkinleştirin.",
      },
      {
        id: "offline",
        icon: Wifi,
        title: "Senkronizasyon ve Depolama Modları",
        description: "Sistem üç depolama moduna sahiptir. Ayarlar'dan uygun olanı seçin.",
        steps: [
          "Firebase (varsayılan): veriler bulut Firestore'da saklanır. İnternet gerektirir.",
          "IndexedDB (yerel): veriler cihazda saklanır. İnternet gerekmez.",
          "Yerel Sunucu (LAN): veriler şirket ağ sunucusunda saklanır.",
          "Çevrimdışı modda taramalar kuyruğa alınır ve bağlantı kurulunca gönderilir.",
        ],
        tip: "Yedekleme sekmesini her 6 veya 24 saatte otomatik JSON/ZIP anlık görüntüsü için etkinleştirin.",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "Davet Koduyla Katılma",
        description: "İlk girişte şirket davet koduyla kayıt olmanız gerekir.",
        steps: [
          "Yöneticinizden benzersiz görevli kodunuzu (örn. G001) ve davet kodunu alın.",
          "Guard bölümüne gidin ve 'Davet koduyla kayıt ol'a tıklayın.",
          "Görevli kodu, davet kodu, tam ad ve PIN (en az 6 hane) girin.",
          "Kayıttan sonra görevli kodu ve PIN ile giriş yapın.",
        ],
        tip: "PIN'inizi ezberleyin. Kurtarmak için yöneticinizle iletişime geçmeniz gerekir.",
      },
      {
        id: "gpsonly",
        icon: Navigation,
        title: "Yalnızca GPS ile Giriş (Kamera Yok)",
        description: "Kontrol noktası GPS-only modundaysa kamera açılmaz.",
        steps: [
          "Tüm noktalar GPS-only ise büyük yeşil buton ekranda görünür.",
          "Yeşil butona basın — sistem GPS konumunuzu alır (kamera açılmaz).",
          "Birkaç saniye sonra sonuç görüntülenir: yeşil = yarıçap içinde, turuncu = dışında.",
          "GPS sürekli arka planda çalışır — manuel yenileme gerekmez.",
        ],
        tip: "Açık havada GPS çok daha hızlıdır. Kapalı alanda 20–30 saniye bekleyin.",
      },
      {
        id: "qrscan",
        icon: QrCode,
        title: "QR Noktası Tarama",
        description: "QR içeren noktalar için telefon kamerasını konumdaki QR'nin üzerine tutun.",
        steps: [
          "Ekranın ortasındaki büyük mavi 'Tara' butonuna basın.",
          "Kamera açılır — QR kodu çerçevenin ortasına getirin.",
          "QR tanındıktan sonra kamera otomatik kapanır.",
          "QR+GPS modunda GPS konumunuz da kontrol edilir.",
          "QR+NFC modunda 'NFC Etiketine Dokun' ekranı açılır.",
        ],
        tip: "Her nokta 5 dakikada bir taranabilir.",
      },
      {
        id: "nfcscan",
        icon: Nfc,
        title: "NFC Etiketi Tarama",
        description: "NFC içeren noktalar için telefonu konumdaki NFC etiketine yaklaştırın.",
        steps: [
          "Android ayarlarında NFC'nin etkin olduğundan emin olun.",
          "Android'de Chrome kullandığınızdan emin olun.",
          "Mor 'NFC Etiketine Dokun' ekranı açılır.",
          "Telefonun arkasını etikete yaklaştırın (1–3 cm).",
          "NFC desteklenmiyorsa atlama butonu görünür.",
        ],
        tip: "Telefonun arka ortasını etikete tutun. 3 cm'den fazla mesafede çalışmaz.",
      },
      {
        id: "gpsoff",
        icon: AlertTriangle,
        title: "GPS Kapalı veya Yarıçap Dışı",
        description: "GPS hatası veya yarıçap dışı mesajı alırsanız bu adımları izleyin.",
        steps: [
          "Telefon Ayarları → Konum'un etkin olduğundan emin olun.",
          "Chrome'da adres çubuğu yanındaki kilit simgesine tıklayın, Konum iznini Etkinleştirin.",
          "Tarayıcıyı kapatıp yeniden açın.",
          "Yarıçap dışı ise tam olarak QR/etikete yakın durun.",
        ],
        tip: "GPS izleyici sürekli arka planda çalışır.",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "Kamera, GPS ve NFC İzinleri",
        description: "Uygulama kamera, konum ve NFC erişimine ihtiyaç duyar.",
        steps: [
          "GPS: ilk açılışta tarayıcı Konum izni ister — İzin Ver'e basın.",
          "Kamera: ilk QR taramada Kamera izni ister — İzin Ver'e basın.",
          "NFC: ilk NFC dokunuşunda NFC izni ister — İzin Ver'e basın.",
          "İzni yanlışlıkla reddettiyseniz: Chrome kilit simgesi → İzinler → her birini İzin Ver yapın.",
        ],
        tip: "PWA kurulumu (Ana Ekrana Ekle) daha iyi deneyim sağlar.",
      },
      {
        id: "offlineguard",
        icon: WifiOff,
        title: "Çevrimdışı Mod ve Sonra Senkronizasyon",
        description: "İnternet kesilirse taramalar kaydedilir ve bağlantı kurulunca gönderilir.",
        steps: [
          "Üstte sarı 'Çevrimdışı' göstergesi bağlantı kesildiğinde görünür.",
          "Taramaya devam edin — tüm taramalar cihaz belleğine kaydedilir.",
          "SOS da çevrimdışı kaydedilir.",
          "İnternet dönünce otomatik senkronizasyon birkaç saniyede gerçekleşir.",
        ],
        tip: "Kontrol noktaları yerel olarak önbelleğe alınır — çevrimdışı QR taraması yapılabilir.",
      },
      {
        id: "sos",
        icon: Phone,
        title: "SOS Uyarısı Gönderme",
        description: "Acil durumda SOS butonunu basılı tutun.",
        steps: [
          "Ana ekrandaki kırmızı SOS butonunu bulun.",
          "3 saniye basılı tutun — ilerleme çubuğunun dolmasını izleyin.",
          "Dolar dolmaz bırakın — SOS uyarısı GPS konumunuzla gönderilir.",
          "Yöneticiniz Kontrol Paneli'nde anında kırmızı uyarı görür.",
        ],
        tip: "SOS'u yalnızca gerçek acil durumlarda gönderin.",
      },
    ],
    faq: [
      { q: "Uygulama internetsiz çalışır mı?", a: "Evet — taramalar çevrimdışı kuyruğa alınır ve bağlantı kurulunca gönderilir." },
      { q: "GPS-only ile QR+GPS farkı nedir?", a: "GPS-only'de kamera açılmaz, sadece yeşil butona basmak yeterli. QR+GPS önce QR tarar sonra GPS mesafesini kontrol eder." },
      { q: "NFC telefonumda çalışmıyor?", a: "NFC yalnızca Android Chrome'da çalışır. Uyumsuz cihazlar için atlama butonu görünür." },
      { q: "PIN'imi unuttum ne yapmalıyım?", a: "Yöneticinizle iletişime geçin. Hesabınızı silip yeni PIN ile yeniden kaydedebilir." },
    ],
    troubleshooting: [
      { issue: "GPS bağlanmıyor / düşük doğruluk", fix: "Telefon Ayarları'ndan Konumu etkinleştirin. Tarayıcıyı kapatıp yeniden açın." },
      { issue: "Kamera açılmıyor", fix: "Chrome kilit simgesi → Kamera iznini Etkinleştir → sayfayı yenileyin." },
      { issue: "NFC etiketi algılanmıyor", fix: "Android Ayarlar'dan NFC'yi etkinleştirin. Telefonun arkasını etikete tutun. Chrome Android kullanın." },
      { issue: "Tarama başarılı ama raporlarda görünmüyor", fix: "Çevrimdışıysanız bağlantı kurulunca otomatik senkronize olur. Gönder butonuna basın." },
    ],
  },

  // ── Chinese ───────────────────────────────────────────────────────────────────
  "zh-CN": {
    pageTitle:    "用户指南",
    managerTitle: "管理员指南",
    guardTitle:   "安保人员指南",
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
        description: "安装后的第一步是创建管理员账户并注册公司信息。",
        steps: [
          "进入管理员页面，点击「首次使用？注册」。",
          "选择用户名和密码，输入公司名称。",
          "注册后进入仪表板。从设置标签页复制邀请码。",
          "将邀请码分享给安保人员 — 他们注册时需要用到。",
        ],
        tip: "保管好邀请码。如有需要可在设置中重新生成。",
      },
      {
        id: "guard",
        icon: UserPlus,
        title: "添加安保人员",
        description: "安保人员使用公司邀请码自行注册。",
        steps: [
          "从仪表板设置标签页复制公司邀请码。",
          "将邀请码发送给安保人员。",
          "安保人员进入 Guard 页面，点击「使用邀请码注册」。",
          "安保人员输入：专属编号（如 G001）、邀请码、全名和 PIN（至少6位）。",
          "注册后，安保人员将出现在仪表板的监控标签页中。",
        ],
        tip: "安保编号（如 G001）必须唯一。使用简单易记的编号。",
      },
      {
        id: "checkpoint",
        icon: MapPin,
        title: "添加检查点",
        description: "检查点是安保人员必须按设定间隔巡视的物理位置。",
        steps: [
          "点击左侧菜单中的「检查点」。",
          "点击「添加检查点」按钮。",
          "输入检查点名称和位置描述。",
          "选择扫描模式（QR、GPS、NFC 或组合）。",
          "含 GPS 的模式：点击「使用当前位置」或手动输入坐标。",
          "设置允许半径（米）和巡逻间隔。",
          "保存 — QR 码自动生成。",
        ],
        tip: "仅 QR、仅 NFC 或 QR+NFC 模式无需输入 GPS 坐标。",
      },
      {
        id: "scanmodes",
        icon: Layers,
        title: "扫描模式（7种）",
        description: "每个检查点有独立的扫描模式，决定安保人员需完成哪些操作。",
        steps: [
          "仅 QR：安保人员扫描 QR 码。不检查 GPS。适合室内。",
          "仅 GPS：安保人员点击大绿按钮。系统比较 GPS 位置与检查点坐标。无需相机。",
          "仅 NFC：安保人员将手机靠近 NFC 标签。无需 QR 或 GPS。",
          "QR + GPS：扫描 QR 且 GPS 位置在半径内。室外高可信度。",
          "QR + NFC：扫描 QR 且触碰 NFC 标签。适合受控入口。",
          "GPS + NFC：检查 GPS 且触碰 NFC 标签。无需相机。",
          "全部 (ALL)：QR + GPS + NFC — 关键检查点的最高安全级别。",
        ],
        tip: "在设置中设置公司默认模式。有自定义模式的检查点会覆盖公司默认设置。",
      },
      {
        id: "gpswhen",
        icon: Navigation,
        title: "何时需要 GPS 坐标",
        description: "GPS 坐标仅在需要距离检查的模式下是必填项。",
        steps: [
          "需要 GPS：仅 GPS、QR+GPS、GPS+NFC、全部 — 这些模式测量距离。",
          "可选 GPS：仅 QR、仅 NFC、QR+NFC — 这些模式不需要坐标。",
          "GPS 模式：点击「使用当前位置」从设备 GPS 自动填充。",
          "根据场地大小设置半径：窄入口 = 25–50 米，开阔区域 = 100–200 米。",
        ],
        tip: "为获得最佳精度，采集 GPS 时请站在检查点的实际物理位置。",
      },
      {
        id: "qr",
        icon: QrCode,
        title: "QR 码生成与安装",
        description: "每个检查点都有唯一的 QR 码，必须安装在实际位置。",
        steps: [
          "在检查点标签页中点击目标检查点。",
          "展开「查看 QR 码」部分。",
          "点击「下载 PNG」或「下载 SVG」。",
          "点击「打印 QR」直接从浏览器打印。",
          "将 QR 安装在 120–150 厘米高度的物理位置。",
        ],
        tip: "安装 QR 时确保安保人员必须站在检查点正前方，而非远距离扫描。",
      },
      {
        id: "nfctag",
        icon: Nfc,
        title: "注册 NFC 标签",
        description: "NFC 标签无需相机即可验证物理在场。",
        steps: [
          "购买标准 NDEF NFC 标签（类型1–5）。",
          "创建含 NFC 扫描模式的检查点。",
          "将 NFC 贴纸粘贴在物理检查点位置。",
          "巡逻时，安保人员将安卓手机靠近标签 — 系统记录 NFC 验证。",
          "无需对标签编程 — 系统只确认物理在场。",
        ],
        tip: "NFC 通过 Web NFC API 工作，仅支持 Android 版 Chrome。iOS 和其他浏览器不支持。始终显示跳过按钮供不兼容设备使用。",
      },
      {
        id: "liverecords",
        icon: FileText,
        title: "实时记录与监控",
        description: "所有扫描记录、安保位置和警报均可实时查看。",
        steps: [
          "巡逻日志标签：带过滤器的全部扫描列表，含 CSV 导出按钮。",
          "监控标签：活跃安保会话、最新 GPS 位置、最近检查点。",
          "地图标签：所有活跃安保人员的实时位置。",
          "警报标签：紧急 SOS 和系统警告。红色标记 = 未读警报。",
        ],
        tip: "在设置标签页启用浏览器通知，即使在后台也能收到 SOS 警报。",
      },
      {
        id: "offline",
        icon: Wifi,
        title: "同步与存储模式",
        description: "系统有三种存储模式。在设置中选择适合的模式。",
        steps: [
          "Firebase（默认）：数据存储在云端 Firestore。需要网络。",
          "IndexedDB（本地）：所有数据存储在设备上。无需网络。",
          "本地服务器（LAN）：数据存储在公司内网服务器上。",
          "离线时扫描自动排队，重新连接后同步。",
        ],
        tip: "启用备份标签页可每6或24小时自动下载 JSON/ZIP 数据快照。",
      },
    ],
    guard: [
      {
        id: "login",
        icon: LogIn,
        title: "使用邀请码加入",
        description: "首次登录需使用公司邀请码注册。",
        steps: [
          "从管理员处获取您的专属安保编号（如 G001）和公司邀请码。",
          "进入 Guard 页面，点击「使用邀请码注册」。",
          "输入安保编号、邀请码、全名和 PIN（至少6位）。",
          "注册后使用安保编号和 PIN 登录。",
        ],
        tip: "请记住您的 PIN。找回需联系管理员。",
      },
      {
        id: "gpsonly",
        icon: Navigation,
        title: "仅 GPS 签到（无需相机）",
        description: "若检查点设置为仅 GPS 模式，相机不会打开 — 仅检查 GPS 位置。",
        steps: [
          "当所有检查点都是仅 GPS 时，屏幕上显示大绿色按钮。",
          "点击绿色按钮 — 系统获取您的 GPS 位置（不打开相机）。",
          "几秒后显示结果：绿色 = 在半径内，橙色 = 超出范围。",
          "GPS 在后台持续运行 — 无需手动刷新。",
        ],
        tip: "室外 GPS 更快。在室内请等待 20–30 秒以提高精度。",
      },
      {
        id: "qrscan",
        icon: QrCode,
        title: "扫描 QR 检查点",
        description: "含 QR 的检查点，将手机相机对准位置上安装的 QR 码。",
        steps: [
          "点击屏幕中央的大蓝色「扫描检查点」按钮。",
          "相机打开 — 将 QR 码置于取景框中央。",
          "识别 QR 后相机自动关闭。",
          "QR+GPS 模式：还会检查您的 GPS 位置。",
          "QR+NFC 模式：出现「触碰 NFC 标签」屏幕。",
          "最终结果：绿色 = 成功，橙色 = 超出范围，红色 = 错误。",
        ],
        tip: "每个检查点每5分钟只能扫描一次。",
      },
      {
        id: "nfcscan",
        icon: Nfc,
        title: "扫描 NFC 标签",
        description: "含 NFC 的检查点，将手机靠近位置上的 NFC 贴纸。",
        steps: [
          "确保在安卓设置中启用了 NFC（设置→连接→NFC）。",
          "确保使用安卓版 Chrome（iOS 和其他浏览器不支持）。",
          "出现紫色「触碰 NFC 标签」屏幕。",
          "将手机背面靠近标签（1–3 厘米）。",
          "如不支持 NFC，显示跳过按钮。",
        ],
        tip: "将手机背面中央靠近标签。3厘米以上的距离无效。",
      },
      {
        id: "gpsoff",
        icon: AlertTriangle,
        title: "GPS 关闭或超出范围",
        description: "收到 GPS 错误或超出范围提示时，请按以下步骤操作。",
        steps: [
          "GPS 错误：手机设置 → 位置，确保已启用。",
          "在 Chrome 中点击地址栏旁的锁图标，将位置权限设为允许。",
          "关闭并重新打开浏览器，然后重试。",
          "超出范围：请站在 QR/标签正前方，而非远处。",
          "室内等待 20–30 秒让 GPS 精度提高。",
        ],
        tip: "GPS 监控在后台持续运行。屏幕顶部 GPS 指示器为绿色表示已获取位置。",
      },
      {
        id: "permissions",
        icon: Camera,
        title: "相机、GPS 和 NFC 权限",
        description: "应用需要相机（QR扫描）、位置（GPS）和 NFC 访问权限。",
        steps: [
          "GPS：首次启动时浏览器请求位置权限 — 点击允许。",
          "相机：首次扫描 QR 时请求相机权限 — 点击允许。",
          "NFC：首次 NFC 触碰时请求 NFC 权限 — 点击允许。",
          "误拒权限：在 Chrome 中点击锁图标 → 权限 → 全部设为允许。",
        ],
        tip: "安装 PWA（添加到主屏幕）体验更佳。",
      },
      {
        id: "offlineguard",
        icon: WifiOff,
        title: "离线模式与稍后同步",
        description: "网络断开时扫描被保存，重新连接后自动发送。",
        steps: [
          "断开连接时屏幕顶部显示黄色「离线」指示器。",
          "旁边的数字 = 等待发送的扫描数量。",
          "继续正常扫描 — 所有扫描保存在设备内存中。",
          "网络恢复后几秒内自动同步。",
        ],
        tip: "检查点在本地缓存 — 离线时也可扫描 QR 码。",
      },
      {
        id: "sos",
        icon: Phone,
        title: "发送 SOS 警报",
        description: "紧急情况下，长按 SOS 按钮立即通知管理员。",
        steps: [
          "在主巡逻屏幕找到红色 SOS 按钮。",
          "长按3秒 — 观察进度条填满。",
          "进度条满时松开 — 附带 GPS 位置的 SOS 警报立即发送。",
          "管理员在仪表板上立即看到红色闪烁警报。",
        ],
        tip: "仅在真实紧急情况下发送 SOS。每次 SOS 都永久记录在系统中。",
      },
    ],
    faq: [
      { q: "应用没有网络也能使用吗？", a: "可以 — 扫描记录离线排队，连接恢复后自动发送。顶部黄色指示器显示等待发送的扫描数量。" },
      { q: "仅 GPS 和 QR+GPS 有什么区别？", a: "仅 GPS 无需相机，点击绿色按钮即可。QR+GPS 先扫描 QR 码，再检查 GPS 距离。" },
      { q: "NFC 在我的手机上不工作？", a: "NFC 仅在 Android 版 Chrome 中支持。iOS 和其他浏览器不支持。不兼容设备始终显示跳过按钮。" },
      { q: "忘记 PIN 码怎么办？", a: "联系公司管理员。他们可以删除您的账户并用新 PIN 重新注册。" },
      { q: "可以为不同检查点设置不同扫描模式吗？", a: "可以 — 每个检查点有独立的扫描模式。例如：检查点1 = 仅 GPS，检查点2 = QR+GPS，检查点3 = 仅 NFC。" },
    ],
    troubleshooting: [
      { issue: "GPS 无法连接 / 精度低", fix: "检查手机设置中是否已启用位置服务。关闭并重新打开浏览器。在室外效果更好。" },
      { issue: "相机无法打开", fix: "在 Chrome 中点击地址栏旁的锁图标，将相机权限设为允许，然后刷新页面。" },
      { issue: "NFC 标签无法检测", fix: "在安卓设置中启用 NFC。将手机背面（非正面）靠近标签。使用安卓版 Chrome。" },
      { issue: "明明在检查点却显示「超出范围」", fix: "联系管理员增大检查点半径。室内 GPS 可能有 20–50 米误差。" },
      { issue: "扫描成功但报告中不显示", fix: "如果处于离线状态，重新连接后数据将同步。点击发送按钮强制同步。" },
    ],
  },
};

// ─── Component ──────────────────────────────────────────────────────────────────
interface HelpPageProps {
  mode: "manager" | "guard";
  onBack: () => void;
}

export default function HelpPage({ mode, onBack }: HelpPageProps) {
  const { lang, dir, isRTL } = useI18n();
  const c = CONTENT[lang] ?? CONTENT.fa;

  const sections  = mode === "manager" ? c.manager : c.guard;
  const pageTitle = mode === "manager" ? c.managerTitle : c.guardTitle;

  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openFaq, setOpenFaq]         = useState<number | null>(null);
  const [openTrouble, setOpenTrouble] = useState<number | null>(null);
  const [activeTab, setActiveTab]     = useState<"manual" | "faq" | "trouble">("manual");

  const accentColor = mode === "manager" ? "text-primary"    : "text-green-400";
  const accentBg    = mode === "manager" ? "bg-primary/10 border-primary/25"       : "bg-green-500/10 border-green-500/25";
  const accentFill  = mode === "manager" ? "bg-primary"      : "bg-green-500";
  const accentBtn   = mode === "manager"
    ? "bg-primary/10 text-primary border-primary/25 hover:bg-primary/20"
    : "bg-green-500/10 text-green-400 border-green-500/25 hover:bg-green-500/20";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>

      {/* Header */}
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
          <p className="text-[10px] text-muted-foreground">ARC Guard v5.0</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${accentBg}`}>
          {mode === "manager" ? (
            <Shield className={`w-3.5 h-3.5 ${accentColor}`} />
          ) : (
            <BookOpen className={`w-3.5 h-3.5 ${accentColor}`} />
          )}
          <span className={`text-[11px] font-bold ${accentColor}`}>{sections.length}</span>
        </div>
      </header>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-card/80 px-4 pt-3 pb-0 flex gap-1">
        {(["manual", "faq", "trouble"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab
                ? `${accentColor} border-current bg-accent/40`
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab === "manual"  && <BookOpen className="w-3.5 h-3.5" />}
            {tab === "faq"     && <MessageCircleQuestion className="w-3.5 h-3.5" />}
            {tab === "trouble" && <Wrench className="w-3.5 h-3.5" />}
            <span>
              {tab === "manual"  ? (mode === "manager" ? (lang === "fa" ? "راهنما" : lang === "tr" ? "Kılavuz" : lang === "zh-CN" ? "指南" : "Guide") : (lang === "fa" ? "راهنما" : lang === "tr" ? "Kılavuz" : lang === "zh-CN" ? "指南" : "Guide")) : ""}
              {tab === "faq"     ? (lang === "fa" ? "سؤالات" : lang === "tr" ? "SSS" : lang === "zh-CN" ? "常见问题" : "FAQ") : ""}
              {tab === "trouble" ? (lang === "fa" ? "رفع اشکال" : lang === "tr" ? "Sorunlar" : lang === "zh-CN" ? "故障" : "Fixes") : ""}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-2">

          {/* Manual tab */}
          {activeTab === "manual" && sections.map((sec) => {
            const Icon = sec.icon;
            const isOpen = openSection === sec.id;
            return (
              <div key={sec.id} className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? `${accentBg}` : "border-border bg-card"}`}>
                <button
                  onClick={() => setOpenSection(isOpen ? null : sec.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-start hover:bg-accent/40 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOpen ? `${accentFill}/20` : "bg-muted"}`}>
                    <Icon className={`w-4 h-4 ${isOpen ? accentColor : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold leading-snug ${isOpen ? accentColor : "text-foreground"}`}>{sec.title}</p>
                    {!isOpen && (
                      <p className="text-[11px] text-muted-foreground leading-snug truncate mt-0.5">{sec.description}</p>
                    )}
                  </div>
                  {isOpen
                    ? <ChevronUp className={`w-4 h-4 ${accentColor} shrink-0`} />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 space-y-4 border-t border-border/40">
                    <p className="text-[12px] text-muted-foreground leading-relaxed pt-3">{sec.description}</p>

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
