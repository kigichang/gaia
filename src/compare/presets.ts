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
    label: "副熱帶：臺北 ↔ 開羅",
    hint: "緯度只差 5 度，一邊是常濕的副熱帶，一邊是沙漠中的外來河綠洲。",
    lat: 27,
    zoom: 6,
    a: "taipei",
    b: "cairo",
  },
];

export const DEFAULT_PRESET = COMPARE_PRESETS[0];
