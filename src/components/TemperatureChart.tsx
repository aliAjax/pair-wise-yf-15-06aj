import { Sample, fmtTime } from "../types";

interface Props {
  samples: Sample[];
}

/** 环境温度记录图：纯 SVG 折线图，随样本数据实时同步 */
export default function TemperatureChart({ samples }: Props) {
  const data = samples
    .filter((s) => s.temperature !== null && s.sampledAt)
    .slice()
    .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt));

  if (data.length === 0) {
    return <p className="empty">当前范围暂无温度记录</p>;
  }

  const W = 780;
  const H = 280;
  const PL = 48;
  const PR = 20;
  const PT = 22;
  const PB = 52;

  const temps = data.map((d) => d.temperature!);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const lo = Math.floor(min) - 1;
  const hi = Math.ceil(max) + 1;
  const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

  const x = (i: number) =>
    data.length === 1
      ? PL + (W - PL - PR) / 2
      : PL + (i * (W - PL - PR)) / (data.length - 1);
  const y = (t: number) => PT + (1 - (t - lo) / (hi - lo || 1)) * (H - PT - PB);

  const linePath = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.temperature!).toFixed(1)}`
    )
    .join(" ");
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${(H - PB).toFixed(
    1
  )} L${x(0).toFixed(1)},${(H - PB).toFixed(1)} Z`;

  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="环境温度记录图">
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#365314" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#365314" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(t)}
              y2={y(t)}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
            />
            <text x={PL - 8} y={y(t) + 4} textAnchor="end" className="tick">
              {t.toFixed(1)}℃
            </text>
          </g>
        ))}

        {/* 平均线 */}
        <line
          x1={PL}
          x2={W - PR}
          y1={y(avg)}
          y2={y(avg)}
          stroke="#dc2626"
          strokeDasharray="6 5"
          strokeWidth="1.4"
        />
        <text x={W - PR} y={y(avg) - 6} textAnchor="end" className="avg-label">
          平均 {avg.toFixed(1)}℃
        </text>

        <path d={areaPath} fill="url(#tempFill)" />
        <path d={linePath} fill="none" stroke="#365314" strokeWidth="2.4" />

        {data.map((d, i) => {
          const isMax = d.temperature === max;
          const isMin = d.temperature === min;
          return (
            <g key={d.id}>
              <circle
                cx={x(i)}
                cy={y(d.temperature!)}
                r={isMax || isMin ? 6 : 4.5}
                fill={isMax ? "#dc2626" : isMin ? "#2563eb" : "#a16207"}
                stroke="#ffffff"
                strokeWidth="2"
              >
                <title>
                  {`${d.id} · ${d.caseId} · ${d.location}\n${d.temperature}℃ · ${fmtTime(
                    d.sampledAt
                  )}`}
                </title>
              </circle>
              <text
                x={x(i)}
                y={H - PB + 16}
                textAnchor="end"
                className="tick"
                transform={`rotate(-28 ${x(i)} ${H - PB + 16})`}
              >
                {`${d.id} ${fmtTime(d.sampledAt)}`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="chart-stats">
        <span>
          样本数 <b>{data.length}</b>
        </span>
        <span>
          平均 <b>{avg.toFixed(1)}℃</b>
        </span>
        <span>
          最低 <b className="min">{min.toFixed(1)}℃</b>
        </span>
        <span>
          最高 <b className="max">{max.toFixed(1)}℃</b>
        </span>
      </div>
    </div>
  );
}
