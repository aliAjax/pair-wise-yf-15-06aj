import type { Sample, Stage } from "../types";

const STAGE_COLORS: Record<Stage, string> = {
  卵: "#a16207",
  幼虫: "#65a30d",
  蛹: "#7c3aed",
  成虫: "#dc2626",
};

function fmt(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TemperatureChart({ samples }: { samples: Sample[] }) {
  const W = 760;
  const H = 300;
  const ML = 52;
  const MR = 20;
  const MT = 24;
  const MB = 56;
  const iw = W - ML - MR;
  const ih = H - MT - MB;

  const points = [...samples]
    .filter((s) => s.stage !== "" && !Number.isNaN(new Date(s.sampledFrom).getTime()))
    .sort((a, b) => new Date(a.sampledFrom).getTime() - new Date(b.sampledFrom).getTime());

  if (points.length === 0) {
    return (
      <div className="chart-empty">
        <p>当前筛选条件下没有可绘制的温度记录</p>
      </div>
    );
  }

  const temps = points.map((s) => s.temperature);
  const rawMin = Math.min(...temps);
  const rawMax = Math.max(...temps);
  const pad = Math.max(1, (rawMax - rawMin) / 2 || 1);
  const min = Math.floor(rawMin - pad);
  const max = Math.ceil(rawMax + pad);

  const x = (i: number) =>
    points.length === 1 ? ML + iw / 2 : ML + (i * iw) / (points.length - 1);
  const y = (t: number) => MT + ((max - t) / (max - min)) * ih;

  const path = points
    .map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(s.temperature).toFixed(1)}`)
    .join(" ");

  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const t = min + ((max - min) * i) / gridCount;
    return { t, yy: y(t) };
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="环境温度记录图">
        {gridLines.map((g) => (
          <g key={g.t}>
            <line x1={ML} x2={W - MR} y1={g.yy} y2={g.yy} className="grid-line" />
            <text x={ML - 8} y={g.yy + 4} textAnchor="end" className="axis-text">
              {g.t.toFixed(0)}℃
            </text>
          </g>
        ))}

        <line x1={ML} x2={ML} y1={MT} y2={H - MB} className="axis-line" />
        <line x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} className="axis-line" />

        <path d={path} className="temp-path" />

        {points.map((s, i) => (
          <g key={s.id}>
            <circle
              cx={x(i)}
              cy={y(s.temperature)}
              r={6}
              fill={STAGE_COLORS[s.stage as Stage]}
              stroke="#ffffff"
              strokeWidth={2}
            >
              <title>
                {`${s.code}｜${s.caseId}｜${s.stage}${s.stageDetail ? `·${s.stageDetail}` : ""}｜${s.temperature.toFixed(1)}℃｜${fmt(s.sampledFrom)}`}
              </title>
            </circle>
            <text x={x(i)} y={y(s.temperature) - 12} textAnchor="middle" className="temp-text">
              {s.temperature.toFixed(1)}
            </text>
            <text
              x={x(i)}
              y={H - MB + 18}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="axis-text x-label"
            >
              {fmt(s.sampledFrom)}
            </text>
            <text x={x(i)} y={H - MB + 36} textAnchor="middle" className="axis-text code-label">
              {s.code}
            </text>
          </g>
        ))}
      </svg>
      <div className="legend">
        {(Object.keys(STAGE_COLORS) as Stage[]).map((s) => (
          <span key={s} className="legend-item">
            <i style={{ background: STAGE_COLORS[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
