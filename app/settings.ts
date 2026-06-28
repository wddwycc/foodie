// User settings, persisted to localStorage. Read on the client only.
import type { Restaurant } from "./sets";

const KEY = "foodie.settings";

export type Settings = {
  // Hide restaurants that are regularly closed today (今日定休).
  hideClosedToday: boolean;
};

export const DEFAULT_SETTINGS: Settings = { hideClosedToday: false };

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

// Today's weekday in Japan (the data is all in JST), as the canonical char
// used by Restaurant.closed.days.
const WD: Record<string, string> = {
  Sun: "日",
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
};
export function todayWeekdayJP(now: Date = new Date()): string {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(now);
  return WD[short];
}

// Is the restaurant regularly closed today? Only the fixed weekday schedule is
// considered — 不定休 can't be predicted, and 祝 needs a holiday calendar we
// don't have, so neither is treated as "closed today".
export function isClosedToday(
  closed: Restaurant["closed"],
  now: Date = new Date(),
): boolean {
  return closed ? closed.days.includes(todayWeekdayJP(now)) : false;
}
