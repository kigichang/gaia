import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Climate } from "../lib/schema";

const MONTH_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export interface ClimateDomains {
  temp: [number, number];
  precip: [number, number];
}

interface ClimateChartProps {
  climate: Climate;
  /** 兩地共用的 Y 軸範圍。不共用的話兩張圖的柱高就無法互相比較。 */
  domains: ClimateDomains;
}

/**
 * 氣溫雨量圖。
 *
 * 刻意拆成上下兩個各自單一 Y 軸的面板，而不是課本常見的雙 Y 軸雨溫圖：
 * 雙軸的兩條刻度可以任意縮放，會讓「氣溫線和雨量柱交叉」看起來像有因果關係，
 * 其實只是刻度選擇的產物。上下分面板共用月份軸，既保留同樣的判讀方式，
 * 又讓兩地之間可以直接比高度。
 */
export function ClimateChart({ climate, domains }: ClimateChartProps) {
  const data = climate.temperature_c.map((temp, i) => ({
    month: MONTH_LABELS[i],
    temp,
    precip: climate.precipitation_mm[i],
  }));

  const totalPrecip = Math.round(climate.precipitation_mm.reduce((a, b) => a + b, 0));
  const meanTemp = (climate.temperature_c.reduce((a, b) => a + b, 0) / 12).toFixed(1);

  return (
    <div className="climate">
      <dl className="climate-summary">
        <div>
          <dt>年均溫</dt>
          <dd>{meanTemp} °C</dd>
        </div>
        <div>
          <dt>年雨量</dt>
          <dd>{totalPrecip} mm</dd>
        </div>
      </dl>

      <figure className="climate-panel">
        <figcaption>月雨量（mm）</figcaption>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={axisTick} />
            <YAxis
              domain={domains.precip}
              width={44}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <Tooltip content={<ClimateTooltip unit="mm" dataKey="precip" />} cursor={{ fill: "var(--hover-wash)" }} />
            <Bar dataKey="precip" fill="var(--series-precip)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </figure>

      <figure className="climate-panel">
        <figcaption>月均溫（°C）</figcaption>
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={axisTick} />
            <YAxis
              domain={domains.temp}
              width={44}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <Tooltip content={<ClimateTooltip unit="°C" dataKey="temp" />} cursor={{ stroke: "var(--axis)" }} />
            <Line
              dataKey="temp"
              stroke="var(--series-temp)"
              strokeWidth={2}
              dot={{ r: 0 }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </figure>

      <details className="climate-table">
        <summary>資料表</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">月</th>
              <th scope="col">均溫 °C</th>
              <th scope="col">雨量 mm</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <th scope="row">{d.month}</th>
                <td>{d.temp.toFixed(1)}</td>
                <td>{d.precip.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="climate-source">
          {climate.source}，{climate.period} 平均
        </p>
      </details>
    </div>
  );
}

const axisTick = { fill: "var(--text-muted)", fontSize: 11 };

interface TooltipPayloadItem {
  value?: number;
}

function ClimateTooltip({
  active,
  label,
  payload,
  unit,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
  unit: string;
  dataKey: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === undefined) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{label} 月</span>
      <span className="chart-tooltip-value">
        {unit === "mm" ? value.toFixed(0) : value.toFixed(1)} {unit}
      </span>
    </div>
  );
}

/** 由兩地資料算出共用的 Y 軸範圍——共用軸是跨地比較能成立的前提。 */
export function sharedDomains(...items: (Climate | null | undefined)[]): ClimateDomains {
  const present = items.filter((c): c is Climate => Boolean(c));
  if (!present.length) return { temp: [0, 30], precip: [0, 300] };

  const temps = present.flatMap((c) => c.temperature_c);
  const precips = present.flatMap((c) => c.precipitation_mm);

  return {
    temp: [Math.floor(Math.min(...temps, 0) / 5) * 5, Math.ceil(Math.max(...temps) / 5) * 5],
    precip: [0, Math.max(Math.ceil(Math.max(...precips) / 50) * 50, 50)],
  };
}
