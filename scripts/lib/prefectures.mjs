// The 47 prefectures: Japanese name (with suffix), an ascii key for filenames
// and URLs, and the region it belongs to (for grouping in the picker).

export const PREFECTURES = [
  { ja: "北海道", key: "hokkaido", region: "北海道" },

  { ja: "青森県", key: "aomori", region: "東北" },
  { ja: "岩手県", key: "iwate", region: "東北" },
  { ja: "宮城県", key: "miyagi", region: "東北" },
  { ja: "秋田県", key: "akita", region: "東北" },
  { ja: "山形県", key: "yamagata", region: "東北" },
  { ja: "福島県", key: "fukushima", region: "東北" },

  { ja: "茨城県", key: "ibaraki", region: "関東" },
  { ja: "栃木県", key: "tochigi", region: "関東" },
  { ja: "群馬県", key: "gunma", region: "関東" },
  { ja: "埼玉県", key: "saitama", region: "関東" },
  { ja: "千葉県", key: "chiba", region: "関東" },
  { ja: "東京都", key: "tokyo", region: "関東" },
  { ja: "神奈川県", key: "kanagawa", region: "関東" },

  { ja: "新潟県", key: "niigata", region: "中部" },
  { ja: "富山県", key: "toyama", region: "中部" },
  { ja: "石川県", key: "ishikawa", region: "中部" },
  { ja: "福井県", key: "fukui", region: "中部" },
  { ja: "山梨県", key: "yamanashi", region: "中部" },
  { ja: "長野県", key: "nagano", region: "中部" },
  { ja: "岐阜県", key: "gifu", region: "中部" },
  { ja: "静岡県", key: "shizuoka", region: "中部" },
  { ja: "愛知県", key: "aichi", region: "中部" },

  { ja: "三重県", key: "mie", region: "近畿" },
  { ja: "滋賀県", key: "shiga", region: "近畿" },
  { ja: "京都府", key: "kyoto", region: "近畿" },
  { ja: "大阪府", key: "osaka", region: "近畿" },
  { ja: "兵庫県", key: "hyogo", region: "近畿" },
  { ja: "奈良県", key: "nara", region: "近畿" },
  { ja: "和歌山県", key: "wakayama", region: "近畿" },

  { ja: "鳥取県", key: "tottori", region: "中国" },
  { ja: "島根県", key: "shimane", region: "中国" },
  { ja: "岡山県", key: "okayama", region: "中国" },
  { ja: "広島県", key: "hiroshima", region: "中国" },
  { ja: "山口県", key: "yamaguchi", region: "中国" },

  { ja: "徳島県", key: "tokushima", region: "四国" },
  { ja: "香川県", key: "kagawa", region: "四国" },
  { ja: "愛媛県", key: "ehime", region: "四国" },
  { ja: "高知県", key: "kochi", region: "四国" },

  { ja: "福岡県", key: "fukuoka", region: "九州・沖縄" },
  { ja: "佐賀県", key: "saga", region: "九州・沖縄" },
  { ja: "長崎県", key: "nagasaki", region: "九州・沖縄" },
  { ja: "熊本県", key: "kumamoto", region: "九州・沖縄" },
  { ja: "大分県", key: "oita", region: "九州・沖縄" },
  { ja: "宮崎県", key: "miyazaki", region: "九州・沖縄" },
  { ja: "鹿児島県", key: "kagoshima", region: "九州・沖縄" },
  { ja: "沖縄県", key: "okinawa", region: "九州・沖縄" },
];

export const REGION_ORDER = [
  "北海道",
  "東北",
  "関東",
  "中部",
  "近畿",
  "中国",
  "四国",
  "九州・沖縄",
];

// Longest-prefix-first so "東京都" matches before any shorter accidental hit.
const BY_LENGTH = [...PREFECTURES].sort((a, b) => b.ja.length - a.ja.length);

// Resolve the prefecture an address belongs to (it always leads the string).
export function prefectureOf(address) {
  if (!address) return null;
  return BY_LENGTH.find((p) => address.startsWith(p.ja)) ?? null;
}
