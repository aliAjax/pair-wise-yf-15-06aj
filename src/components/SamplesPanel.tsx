import { useState } from "react";
import type { AppState, Sample, Stage } from "../types";
import { deleteSample } from "../lib/store";
import { pushToast } from "../lib/toast";
import SampleForm from "./SampleForm";
import { fmtTime } from "./SampleDetailCard";

const STAGES: Array<Stage | ""> = ["", "卵", "幼虫", "蛹", "成虫"];

export default function SamplesPanel({
  state,
  stageFilter,
  setStageFilter,
  onOpenSample,
  editing,
  setEditing,
}: {
  state: AppState;
  stageFilter: Stage | "";
  setStageFilter: (s: Stage | "") => void;
  onOpenSample: (s: Sample) => void;
  editing: Sample | null;
  setEditing: (s: Sample | null) => void;
}) {
  const [caseFilter, setCaseFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  const filtered = state.samples.filter(
    (s) =>
      (stageFilter === "" || s.stage === stageFilter) &&
      (caseFilter === "" || s.caseId === caseFilter)
  );

  const handleDelete = (s: Sample) => {
    const r = deleteSample(s.id);
    pushToast(r.message, r.ok);
  };

  if (showForm || editing) {
    return (
      <section className="panel">
        <div className="heading">
          <div>
            <p>专业字段</p>
            <h2>{editing ? `编辑样本 ${editing.code}` : "新增样本记录"}</h2>
          </div>
        </div>
        <SampleForm
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      </section>
    );
  }

  return (
    <div className="samples-panel">
      <section className="panel">
        <div className="heading">
          <div>
            <p>专业字段</p>
            <h2>样本工作台</h2>
          </div>
          <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            新增样本
          </button>
        </div>

        <div className="filter-row">
          <span className="muted small">发育阶段筛选：</span>
          <div className="chips">
            {STAGES.map((s) => (
              <button
                key={s || "all"}
                className={stageFilter === s ? "chip-active" : ""}
                onClick={() => setStageFilter(s)}
              >
                {s || "全部"}
              </button>
            ))}
          </div>
          <span className="muted small">案件：</span>
          <select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)}>
            <option value="">全部案件</option>
            {state.cases.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="muted small member-spacer" />
          <span className="muted small">命中 {filtered.length} 条</span>
        </div>

        <div className="sample-list">
          {filtered.map((s) => (
            <article key={s.id} className={`sample-row sr-${s.status}`}>
              <button className="sample-main" onClick={() => onOpenSample(s)}>
                <div className="sr-head">
                  <h3>{s.code}</h3>
                  <span className={`badge st-${s.status}`}>
                    {s.status === "sealed" ? "已封存" : s.status === "reviewing" ? "待复核" : s.status === "in_batch" ? "批次中" : s.status === "ready" ? "可提交" : "待鉴定"}
                  </span>
                </div>
                <p className="muted small">
                  {s.caseId} · {s.location} · {fmtTime(s.sampledFrom)} ~ {fmtTime(s.sampledTo)} ·{" "}
                  {s.temperature.toFixed(1)}℃
                </p>
                <p className="sr-line">
                  {s.species || <em>种类缺失</em>} · {s.stage || <em>阶段缺失</em>}
                  {s.stageDetail ? `（${s.stageDetail}）` : ""} · {s.preservation || <em>保存方式缺失</em>}
                </p>
                {!s.conclusion && <p className="warn-inline">鉴定结论缺失 —— 补齐四项后方可随批次提交</p>}
                {s.status === "reviewing" && (
                  <p className="warn-inline">
                    待复核：同案件、同地点且采样时间重叠，请调整采样时间/地点后在批次页执行「重查采样时间」
                  </p>
                )}
              </button>
              <div className="sr-actions">
                <button
                  className="mini"
                  onClick={() => {
                    setEditing(s);
                    setShowForm(false);
                  }}
                >
                  编辑
                </button>
                {(s.status === "pending" || s.status === "ready") && (
                  <button className="mini danger" onClick={() => handleDelete(s)}>
                    删除
                  </button>
                )}
              </div>
            </article>
          ))}
          {filtered.length === 0 && <p className="muted">当前筛选条件下没有样本。</p>}
        </div>
      </section>
    </div>
  );
}
