import { useMemo, useState } from "react";
import "./styles.css";
import type { Sample, Stage } from "./types";
import { resetAll, useStore } from "./lib/store";
import { pushToast, useToasts } from "./lib/toast";
import { avgTemp } from "./lib/domain";
import BatchPanel from "./components/BatchPanel";
import SamplesPanel from "./components/SamplesPanel";
import CasesPanel from "./components/CasesPanel";
import TemperatureChart from "./components/TemperatureChart";
import Modal from "./components/Modal";
import SampleDetailCard from "./components/SampleDetailCard";

type Tab = "batch" | "samples" | "cases" | "chart";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "batch", label: "批次封存" },
  { key: "samples", label: "样本工作台" },
  { key: "cases", label: "案件样本关联" },
  { key: "chart", label: "温度记录图" },
];

function App() {
  const state = useStore();
  const toasts = useToasts();
  const [tab, setTab] = useState<Tab>("batch");
  const [stageFilter, setStageFilter] = useState<Stage | "">("");
  const [chartCase, setChartCase] = useState<string>("");
  const [detail, setDetail] = useState<Sample | null>(null);
  const [editing, setEditing] = useState<Sample | null>(null);

  const metrics = useMemo(() => {
    const identified = state.samples.filter((s) => s.stage !== "");
    return {
      batches: state.batches.length,
      avg: avgTemp(state.samples),
      stages: new Set(identified.map((s) => s.stage)).size,
      pending: state.samples.filter((s) => s.status === "pending").length,
      sealed: state.samples.filter((s) => s.status === "sealed").length,
      reviewing: state.samples.filter((s) => s.status === "reviewing").length,
      paused: state.batches.filter((b) => b.status === "unsealed").length,
    };
  }, [state]);

  const chartSamples = state.samples.filter(
    (s) =>
      (stageFilter === "" || s.stage === stageFilter) &&
      (chartCase === "" || s.caseId === chartCase)
  );

  // 详情弹窗始终展示最新数据
  const liveDetail = detail ? state.samples.find((s) => s.id === detail.id) ?? null : null;

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62003 · 源提示词5 · Port 62003</p>
        <h1>法医昆虫学样本记录 · 补批次鉴定封存</h1>
        <span>
          昆虫种类、发育阶段、鉴定结论、保存方式四项齐全方可随批次提交；封存时同一案件、相同地点且采样时间重叠的样本退回待复核，
          原批次与已有封存记录不变。封存样本被复核退回时批次立即解封、暂停导出，处理后重查采样时间通过方可恢复封存。
          批次、案件关联与温度记录本地保存，刷新后仍在。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>样本批次</small>
          <strong>{metrics.batches}</strong>
        </article>
        <article>
          <small>平均温度</small>
          <strong>{metrics.avg}℃</strong>
        </article>
        <article>
          <small>发育阶段（类）</small>
          <strong>{metrics.stages}</strong>
        </article>
        <article>
          <small>待鉴定 / 已封存</small>
          <strong>
            {metrics.pending}
            <em className="metric-sub"> / {metrics.sealed}</em>
          </strong>
        </article>
      </section>

      {(metrics.reviewing > 0 || metrics.paused > 0) && (
        <div className="global-banner">
          ⚠ 当前有 {metrics.reviewing} 个样本待复核，{metrics.paused} 个批次已解封并暂停导出；处理完成并通过采样时间重查后自动恢复封存。
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
        <span className="member-spacer" />
        <button
          className="mini"
          onClick={() => {
            const r = resetAll();
            pushToast(r.message, r.ok);
          }}
        >
          恢复演示数据
        </button>
      </nav>

      {tab === "batch" && <BatchPanel state={state} onOpenSample={setDetail} />}
      {tab === "samples" && (
        <SamplesPanel
          state={state}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          onOpenSample={setDetail}
          editing={editing}
          setEditing={setEditing}
        />
      )}
      {tab === "cases" && <CasesPanel state={state} onOpenSample={setDetail} />}
      {tab === "chart" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>环境温度</p>
              <h2>温度记录图（按采样时间）</h2>
            </div>
          </div>
          <div className="filter-row">
            <span className="muted small">发育阶段：</span>
            <div className="chips">
              {(["", "卵", "幼虫", "蛹", "成虫"] as Array<Stage | "">).map((s) => (
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
            <select value={chartCase} onChange={(e) => setChartCase(e.target.value)}>
              <option value="">全部案件</option>
              {state.cases.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <TemperatureChart samples={chartSamples} />
        </section>
      )}

      {liveDetail && (
        <Modal title="单个样本详情卡片" onClose={() => setDetail(null)} wide>
          <SampleDetailCard sample={liveDetail}>
            {(liveDetail.status === "pending" || liveDetail.status === "ready") && (
              <button
                className="primary"
                onClick={() => {
                  setEditing(liveDetail);
                  setTab("samples");
                  setDetail(null);
                }}
              >
                去补齐鉴定信息
              </button>
            )}
            {liveDetail.status === "reviewing" && (
              <span className="muted small">
                待复核样本请到「批次封存」页处理并执行「重查采样时间」。
              </span>
            )}
          </SampleDetailCard>
        </Modal>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={t.ok ? "toast ok" : "toast err"}>
            {t.message}
          </div>
        ))}
      </div>

      <footer className="page-foot muted small">
        批次列表、案件关联与温度图共享同一份数据并通过 localStorage 本地保存，刷新页面后仍在。
      </footer>
    </main>
  );
}

export default App;
