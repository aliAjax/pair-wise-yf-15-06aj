import type { Sample, SampleStatus } from "../types";
import { statusLabel } from "../lib/domain";

export function StatusBadge({ status }: { status: SampleStatus }) {
  return <span className={`badge st-${status}`}>{statusLabel(status)}</span>;
}

export function fmtTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SampleDetailCard({
  sample,
  children,
}: {
  sample: Sample;
  children?: React.ReactNode;
}) {
  return (
    <article className="detail-card">
      <header>
        <div>
          <h3>{sample.code}</h3>
          <p className="muted">
            {sample.caseId} · {sample.location}
          </p>
        </div>
        <StatusBadge status={sample.status} />
      </header>
      <dl className="detail-grid">
        <div>
          <dt>采样时间</dt>
          <dd>
            {fmtTime(sample.sampledFrom)} ~ {fmtTime(sample.sampledTo)}
          </dd>
        </div>
        <div>
          <dt>环境温度</dt>
          <dd>{sample.temperature.toFixed(1)} ℃</dd>
        </div>
        <div>
          <dt>暴露阶段</dt>
          <dd>{sample.exposureStage || "—"}</dd>
        </div>
        <div>
          <dt>发育阶段</dt>
          <dd>
            {sample.stage || "—"}
            {sample.stageDetail ? `（${sample.stageDetail}）` : ""}
          </dd>
        </div>
        <div>
          <dt>昆虫种类</dt>
          <dd>{sample.species || "—"}</dd>
        </div>
        <div>
          <dt>保存方式</dt>
          <dd>{sample.preservation || "—"}</dd>
        </div>
        <div className="span2">
          <dt>鉴定结论</dt>
          <dd>{sample.conclusion || "—"}</dd>
        </div>
        <div className="span2">
          <dt>鉴定备注</dt>
          <dd>{sample.note || "—"}</dd>
        </div>
        <div>
          <dt>封存时间</dt>
          <dd>{fmtTime(sample.sealedAt)}</dd>
        </div>
      </dl>
      {children && <footer className="card-actions">{children}</footer>}
    </article>
  );
}
