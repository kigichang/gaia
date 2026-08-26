export interface ComparePreset {
  id: string;
  label: string;
  /** 一句話說明這組比較想讓學生看見什麼 */
  hint: string;
  lat: number;
  zoom: number;
  a: string;
  b: string;
}

/**
 * 預設比較組合。每一組都刻意挑選「緯度接近、地理條件差很多」的配對，
 * 讓學生自己看出緯度不是決定氣候的唯一因素。
 *
 * 最後一組是**反過來的對照**：前面幾組是「氣溫接近、雨量差很多」，
 * 大塔山 ↔ 玉山則是「雨量幾乎一樣、氣溫差很多」，把海拔單獨隔離出來。
 */
export const COMPARE_PRESETS: ComparePreset[] = [
  {
    id: "tropic-taiwan-sahara",
    label: "北回歸線：臺灣 ↔ 撒哈拉",
    hint: "兩地年均溫幾乎相同，年雨量卻差了數十倍——差別來自海陸位置與大氣環流。",
    lat: 23.4,
    zoom: 7,
    a: "yushan",
    b: "tamanrasset",
  },
  {
    id: "tropic-sahara-hawaii",
    label: "沙漠 ↔ 海洋：撒哈拉 ↔ 夏威夷",
    hint: "同樣在副熱帶，位於大陸內部與位於海洋上的降水差異。",
    lat: 21,
    zoom: 7,
    a: "tamanrasset",
    b: "hilo",
  },
  {
    id: "tropic-taiwan-mexico",
    label: "北回歸線：臺灣 ↔ 墨西哥",
    hint: "同為北回歸線通過的海岸地區，乾濕季分明的程度不同。",
    lat: 23.4,
    zoom: 7,
    a: "yushan",
    b: "mazatlan",
  },
  {
    id: "subtropical-taipei-cairo",
    label: "副熱帶：臺北盆地 ↔ 開羅",
    hint: "緯度只差 5 度，一邊是常濕的副熱帶，一邊是沙漠中的外來河綠洲。",
    lat: 27,
    zoom: 6,
    a: "taipei",
    b: "cairo",
  },
  // ── 2026-08 新增：世界城市大幅補齊之後才配得出來的五組 ──────────────
  //
  // ⚠️ 每一組都是「緯度接近、但只有一個變因不同」，`hint` 要把那個變因講出來。
  // 挑法見 CLAUDE_WORLD.md「世界重要城市：為什麼是這 26 個」。
  {
    id: "east-west-coast-tokyo-la",
    label: "大陸東岸 ↔ 西岸：東京 ↔ 洛杉磯",
    hint: "同樣在北緯 35° 附近，東京夏雨、洛杉磯夏乾——大陸東岸受季風與海洋水氣影響，西岸夏季被副熱帶高壓罩住。這一組把「東岸／西岸」單獨隔離出來看。",
    lat: 35,
    zoom: 6,
    a: "tokyo",
    b: "los-angeles",
  },
  {
    id: "equator-altitude-singapore-nairobi",
    label: "赤道上的海拔：新加坡 ↔ 奈洛比",
    hint: "兩地都在赤道上（南北緯 1.3°），年均溫卻差了八度——差別只有海拔：新加坡 15 公尺、奈洛比 1,795 公尺。這一組把「高度」單獨隔離出來看。",
    lat: 0,
    zoom: 5,
    a: "singapore",
    b: "nairobi",
  },
  {
    id: "tropic-south-saopaulo-alice",
    label: "南回歸線：聖保羅 ↔ 愛麗絲泉",
    hint: "南回歸線幾乎穿過這兩個地方，年雨量卻差了五倍以上——一個在大陸東岸的高原、一個在大陸內部的沙漠。跟北回歸線上的臺灣 ↔ 撒哈拉是同一種對照。",
    lat: -23.5,
    zoom: 6,
    a: "sao-paulo",
    b: "alice-springs",
  },
  {
    id: "south-east-west-capetown-sydney",
    label: "南半球東西岸：開普敦 ↔ 雪梨",
    hint: "兩地都在南緯 33.9°，開普敦夏乾冬雨（地中海型）、雪梨全年有雨。南半球版的大陸西岸／東岸對比，季節與北半球正好相反。",
    lat: -33.9,
    zoom: 6,
    a: "cape-town",
    b: "sydney",
  },
  {
    id: "highlat-current-reykjavik-nuuk",
    label: "高緯度的洋流：雷克雅維克 ↔ 努克",
    hint: "兩地都在北緯 64°、都在海邊，冬季均溫卻差了十度以上——一邊有北大西洋暖流、一邊是從北極南下的寒流。這一組把「洋流」單獨隔離出來看。",
    lat: 64.2,
    zoom: 4,
    a: "reykjavik",
    b: "nuuk",
  },
  {
    id: "elevation-datashan-yushan",
    label: "同緯度不同海拔：大塔山 ↔ 玉山",
    hint: "同在 23.5°N 的臺灣山區，年雨量幾乎一樣（約 3000 mm），海拔差 1290 公尺，年均溫就差了 6.5 °C——這一組把海拔單獨隔離出來看。",
    lat: 23.5,
    // 兩座山相距不到 30 公里，拉近才看得到等高線（zoom ≥ 9 才畫）
    zoom: 10,
    a: "datashan",
    b: "yushan",
  },
];

export const DEFAULT_PRESET = COMPARE_PRESETS[0];
