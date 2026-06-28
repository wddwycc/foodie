// Extract and normalize a restaurant's regular closing days (定休日) from a
// cached Tabelog detail page. No network — pure parsing of the page HTML.
//
// Tabelog encodes this two ways inside the FAQ JSON-LD answer to the
// "営業時間・定休日を教えてください" question:
//   1. A free-text note:        ■ 定休日\n木曜日 (祝日の場合は翌日)
//   2. A per-weekday schedule:  [日]\n　定休日   (that weekday is closed)
// Some pages carry both; many carry only one. We merge them.
//
// Returns a normalized object, or null when nothing usable was found:
//   { days: string[], irregular: boolean, note: string | null }
// where `days` is the set of weekly closing days as canonical single chars
// (月火水木金土日, plus 祝 for public holidays), `irregular` flags 不定休, and
// `note` keeps original text that carries more than a plain weekday list.
// A place open every day is { days: [], irregular: false, note: "無休" }.

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const DAY_ORDER = [...WEEKDAYS, "祝"];

// Pull the 定休日 FAQ answer text out of the page's JSON-LD blocks.
function faqAnswer(html) {
  const re =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      if (node["@type"] !== "FAQPage") continue;
      for (const q of node.mainEntity ?? []) {
        if ((q.name ?? "").includes("定休日")) {
          return q.acceptedAnswer?.text ?? "";
        }
      }
    }
  }
  return null;
}

// Order + dedupe a list of day chars by the canonical weekday order.
function orderDays(set) {
  return DAY_ORDER.filter((d) => set.has(d));
}

export function normalizeClosed(text) {
  if (text == null) return null;

  const days = new Set();

  // (2) Per-weekday schedule: a "[木]" entry whose hours are "定休日".
  for (const d of WEEKDAYS) {
    if (new RegExp(`\\[${d}\\][^\\[]*?定休日`).test(text)) days.add(d);
  }
  // The schedule lists holidays as "[祝日]".
  if (/\[祝(?:日)?\][^\[]*?定休日/.test(text)) days.add("祝");

  // (1) Free-text note after the "■ 定休日" marker.
  const noteMatch = text.match(/■\s*定休日\s*([\s\S]*?)(?:<\/p>|$)/);
  let note = noteMatch
    ? noteMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : null;

  const irregular = note ? /不定休/.test(note) : false;

  if (note) {
    // Weekday tokens written as "月曜"/"火曜日" are unambiguous (the bare 月/日
    // also mean month/day-of-month in dates, so only match when 曜 follows).
    // Holidays (祝) are NOT inferred from free text: notes like "祝日の場合は
    // 営業" mean *open* on holidays, so the bare mention is too ambiguous —
    // only the per-weekday schedule's "[祝日] 定休日" is trustworthy for 祝.
    for (const m of note.matchAll(/([月火水木金土日])曜/g)) days.add(m[1]);
  }

  if (days.size === 0 && !note) {
    // No note and no closed weekdays. If the schedule lists hours for the
    // weekdays, the place is open every day; otherwise we know nothing.
    const hasSchedule = WEEKDAYS.some((d) =>
      new RegExp(`\\[${d}\\]`).test(text),
    );
    if (hasSchedule) return { days: [], irregular: false, note: "無休" };
    return null;
  }

  // Drop the note when it adds nothing beyond the weekday list / 不定休 we
  // already captured (keeps the field tidy for the common cases).
  if (note) {
    const leftover = note
      .replace(/[月火水木金土日]曜日?/g, "")
      .replace(/祝(?:祭)?日?/g, "")
      .replace(/不定休/g, "")
      .replace(/[\s・、,，]/g, "");
    if (leftover === "") note = null;
  }

  return { days: orderDays(days), irregular, note };
}

export function extractClosed(html) {
  return normalizeClosed(faqAnswer(html));
}
