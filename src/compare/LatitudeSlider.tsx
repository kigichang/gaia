interface LatitudeSliderProps {
  lat: number;
  onChange: (lat: number) => void;
}

/** 重要緯線，讓學生可以一鍵跳到課本上的參考線。 */
const LANDMARKS = [
  { lat: 66.5, label: "北極圈" },
  { lat: 23.5, label: "北回歸線" },
  { lat: 0, label: "赤道" },
  { lat: -23.5, label: "南回歸線" },
];

export function LatitudeSlider({ lat, onChange }: LatitudeSliderProps) {
  return (
    <div className="lat-slider">
      <div className="lat-slider-head">
        <label htmlFor="lat-range">緯度鎖定</label>
        <output className="lat-value">{formatLatitude(lat)}</output>
      </div>
      <input
        id="lat-range"
        type="range"
        min={-60}
        max={75}
        step={0.1}
        value={lat}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="lat-landmarks">
        {LANDMARKS.map((m) => (
          <button key={m.label} type="button" onClick={() => onChange(m.lat)}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function formatLatitude(lat: number) {
  const hemisphere = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(1)}°${hemisphere}`;
}
