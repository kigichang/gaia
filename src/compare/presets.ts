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
