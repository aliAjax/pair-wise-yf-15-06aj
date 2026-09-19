import type { AppState, Sample } from "../types";
import { fmtTime } from "./SampleDetailCard";
import { avgTemp, statusLabel } from "../lib/domain";

export default function CasesPanel({
  state,
  onOpenSample,
}: {
  state: AppState;
  onOpenSample: (s: Sample) => void;
}) {
  return (
    <div className="cases-panel">
      {state.cases.map((caseId) => {
        const samples = state.samples
          .filter((s) => s.caseId === caseId)
          .sort((a, b) => new Date(a.sampledFrom).getTime() - new Date(b.sampledFrom).getTime());
        const batchIds = [...new Set(samples.map((s) => s.batchId).filter(Boolean))] as string[];
        const sealedCount = samples.filter((s) => s.status === "sealed").length;
        const reviewCount = samples.filter((s) => s.status === "reviewing").length;

        return (
          <section key={caseId} className="panel case-panel">
            <div className="heading">
              <div>
                <p>案件样本关联</p>
                <h2>{caseId}</h2>
              </div>
              <div className="case-meta">
                <span>样本 {samples.length}</span>
                <span>均温 {avgTemp(samples)}℃</span>
                <span>已封存 {sealedCount}</span>
                {reviewCount > 0 && <span className="danger-text">待复核 {reviewCount}</span>}
              </div>
            </div>

            <div className="case-batches muted small">
              关联批次：
              {batchIds.length === 0 && <span>暂无（样本尚未提交批次）</span>}
              {batchIds.map((bid) => {
                const b = state.batches.find((x) => x.id === bid);
                return (
                  <span key={bid} className={`chip bt-${b?.status ?? "open"}`}>
                    {b?.name ?? bid}
                    {b ? ` · ${b.status === "sealed" ? "已封存" : b.status === "unsealed" ? "已解封·暂停导出" : "待封存"}` : ""}
                  </span>
                );
              })}
            </div>

            <div className="timeline">
              {samples.map((s) => (
                <button key={s.id} className="timeline-item" onClick={() => onOpenSample(s)}>
                  <div className="tl-time">{fmtTime(s.sampledFrom)}</div>
                  <div className="tl-body">
                    <strong>{s.code}</strong>
                    <span className="muted small">
                      {s.location} · {s.stage || "阶段未定"}
                      {s.stageDetail ? `（${s.stageDetail}）` : ""} · {s.temperature.toFixed(1)}℃
                    </span>
                    <span className="muted tiny">{s.species || "种类待鉴定"}</span>
                  </div>
                  <span className={`badge st-${s.status}`}>{statusLabel(s.status)}</span>
                </button>
              ))}
              {samples.length === 0 && <p className="muted">该案件暂无样本</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
