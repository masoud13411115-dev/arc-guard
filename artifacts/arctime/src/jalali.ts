import jalaali from "jalaali-js";

export const JALALI_MONTH_NAMES = [
  "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
  "مهر","آبان","آذر","دی","بهمن","اسفند",
];

/** JS Date → "1403/08/20" */
export function toJalaliDate(d: Date): string {
  const { jy, jm, jd } = jalaali.toJalaali(
    d.getFullYear(), d.getMonth() + 1, d.getDate()
  );
  return `${jy}/${String(jm).padStart(2,"0")}/${String(jd).padStart(2,"0")}`;
}

/** JS Date → "1403/08/20 14:30:00" (24-hour) */
export function toJalaliDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2,"0");
  const m = String(d.getMinutes()).padStart(2,"0");
  const s = String(d.getSeconds()).padStart(2,"0");
  return `${toJalaliDate(d)} ${h}:${m}:${s}`;
}

/** Jalali year + month (1-based) → "آبان ۱۴۰۳" */
export function toJalaliMonthLabel(jy: number, jm: number): string {
  return `${JALALI_MONTH_NAMES[jm - 1]} ${jy}`;
}

/** Current Jalali { jy, jm, jd } */
export function nowJalali(): { jy: number; jm: number; jd: number } {
  const n = new Date();
  const { jy, jm, jd } = jalaali.toJalaali(
    n.getFullYear(), n.getMonth() + 1, n.getDate()
  );
  return { jy, jm, jd };
}

/** Add delta months to a Jalali year+month */
export function addJalaliMonths(
  jy: number, jm: number, delta: number
): { jy: number; jm: number } {
  let m = jm + delta, y = jy;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return { jy: y, jm: m };
}

/** Gregorian Date range for a Jalali year+month */
export function jalaliMonthRange(
  jy: number, jm: number
): { start: Date; end: Date } {
  const { gy: sy, gm: sm, gd: sd } = jalaali.toGregorian(jy, jm, 1);
  const days = jalaali.jalaaliMonthLength(jy, jm);
  const { gy: ey, gm: em, gd: ed } = jalaali.toGregorian(jy, jm, days);
  return {
    start: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
    end:   new Date(ey, em - 1, ed, 23, 59, 59, 999),
  };
}

/** Gregorian ISO "YYYY-MM-DD" → Jalali "1403/08/20" */
export function gregToJalaliStr(iso: string): string {
  const parts = iso.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return iso;
  const [y, m, d] = parts;
  const { jy, jm, jd } = jalaali.toJalaali(y, m, d);
  return `${jy}/${String(jm).padStart(2,"0")}/${String(jd).padStart(2,"0")}`;
}

/** Jalali "1403/08/20" → Gregorian ISO "2024-11-10", or null on error */
export function jalaliStrToGreg(s: string): string | null {
  const parts = s.trim().split("/").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [jy, jm, jd] = parts;
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31 || jy < 1300) return null;
  try {
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    return `${gy}-${String(gm).padStart(2,"0")}-${String(gd).padStart(2,"0")}`;
  } catch {
    return null;
  }
}

/** Today as Jalali "1403/08/20" */
export function todayJalali(): string {
  return toJalaliDate(new Date());
}

/** JS Date → dash-separated key "1403-08-20" (for reliable string comparison) */
export function jalaliDateKey(d: Date): string {
  const { jy, jm, jd } = jalaali.toJalaali(
    d.getFullYear(), d.getMonth() + 1, d.getDate()
  );
  return `${jy}-${String(jm).padStart(2,"0")}-${String(jd).padStart(2,"0")}`;
}

/** Today as dash key "1403-08-20" */
export function todayJalaliKey(): string {
  return jalaliDateKey(new Date());
}

/** JS Date → "HH:MM" local time */
export function localTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
