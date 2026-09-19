import { useState } from "react";
import type { AppState, Batch, Sample } from "../types";
import {
  createBatch,
  recheckReviewSample,
  sealBatch,
  sendSealedToReview,
  submitToBatch,
  withdrawFromBatch,
  type SealReport,
} from "../lib/store";
import { pushToast } from "../lib/toast";
import { batchStatusLabel, describePair, isIdentified } from "../lib/domain";
import Modal from "./Modal";

export default function BatchPanel({
  state,
  onOpenSample,
}: {
  state: AppState;
  onOpenSample: (s: Sample) => void;
}) {
  const [newName, setNewName] = useState("");
  const [targetBatch, setTargetBatch] = useState<string>("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<SealReport | null>(null);

  const readySamples = state.samples.filter((s) => s.status === "ready" && isIdentified(s));
  const openBatches = state.batches.filter((b) => b.status === "open");
  const submitBatchId = targetBatch || openBatches[0]?.id || "";

  const handleCreate = () => {
    const r = createBatch(newName);
    pushToast(r.message, r.ok);
    setNewName("");
  };

  const handleSubmit = () => {
    if (!submitBatchId) {
      pushToast("请先创建一个待封存批次", false);
      return;
    }
    const ids = [...picked];
    if (ids.length === 0) {
      pushToast("请勾选要提交的样本", false);
      return;
    }
    const r = submitToBatch(ids, submitBatchId);
    pushToast(r.message, r.ok);
    if (r.ok) setPicked(new Set());
  };

  const handleSeal = (b: Batch) => {
    const r = sealBatch(b.id);
    pushToast(r.message, r.ok);
    if (r.report) setReport(r.report);
  };

  const handleReview = (s: Sample) => {
    const r = sendSealedToReview(s.id);
    pushToast(r.message, r.ok);
  };

  const handleRecheck = (s: Sample) => {
    const r = recheckReviewSample(s.id);
    pushToast(r.message, r.ok);
  };

  const handleWithdraw = (s: Sample) => {
    const r = withdrawFromBatch(s.id);
    pushToast(r.message, r.ok);
  };

  const handleExport = (b: Batch) => {
    if (b.status !== "sealed") {
      pushToast(`批次 ${b.name} 当前「${batchStatusLabel(b)}」，已暂停导出`, false);
      return;
    }
    const members = state.samples.filter((s) => s.batchId === b.id && s.status === "sealed");
    const lines = [
      `批次编号,${b.name}`,
      `批次状态,${batchStatusLabel(b)}`,
      `封存时间,${b.sealedAt ?? ""}`,
      "",
      "样本编号,案件,采样地点,采样起,采样止,温度,昆虫种类,发育阶段,保存方式,鉴定结论",
      ...members.map((s) =>
        [
          s.code,
          s.caseId,
          s.location,
          s.sampledFrom,
          s.sampledTo,
          s.temperature.toFixed(1),
          s.species,
          `${s.stage}${s.stageDetail ? `(${s.stageDetail})` : ""}`,
          s.preservation,
          s.conclusion,
        ]
          .map((c) => `"${String(c).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${b.name}-封存清单.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`批次 ${b.name} 封存清单已导出`);
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="batch-panel">
      <section className="panel">
        <div className="heading">
          <div>
            <p>补批次鉴定封存</p>
            <h2>批次列表</h2>
          </div>
          <div className="create-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="批次编号（留空自动生成）"
            />
            <button className="primary" onClick={handleCreate}>
              新建批次
            </button>
          </div>
        </div>

        <div className="batch-grid">
          {state.batches.map((b) => {
            const members = state.samples.filter((s) => s.batchId === b.id);
            const sealed = members.filter((m) => m.status === "sealed");
            const inBatch = members.filter((m) => m.status === "in_batch");
            const reviewing = members.filter((m) => m.status === "reviewing");
            return (
              <article key={b.id} className={`batch-card bc-${b.status}`}>
                <header>
                  <div>
                    <h3>{b.name}</h3>
                    <p className="muted small">创建 {new Date(b.createdAt).toLocaleString("zh-CN")}</p>
                  </div>
                  <span className={`badge bt-${b.status}`}>{batchStatusLabel(b)}</span>
                </header>
                <div className="batch-counts">
                  <span>共 {members.length}</span>
                  <span className="c-sealed">已封存 {sealed.length}</span>
                  <span className="c-in">待封存 {inBatch.length}</span>
                  <span className="c-rev">待复核 {reviewing.length}</span>
                </div>

                {b.status === "unsealed" && (
                  <div className="warn-bar">封存样本被复核退回，批次已解封并暂停导出；处理后重查采样时间通过将恢复封存</div>
                )}

                <ul className="member-list">
                  {members.map((m) => (
                    <li key={m.id} className={`member ml-${m.status}`}>
                      <button className="link-btn" onClick={() => onOpenSample(m)}>
                        {m.code}
                      </button>
                      <span className="muted small">
                        {m.caseId} · {m.location} · {m.stage || "未鉴定"}
                      </span>
                      <span className="member-spacer" />
                      {m.status === "in_batch" && (
                        <button className="mini" onClick={() => handleWithdraw(m)}>
                          撤回
                        </button>
                      )}
                      {m.status === "sealed" && (
                        <button className="mini danger" onClick={() => handleReview(m)}>
                          复核退回
                        </button>
                      )}
                      {m.status === "reviewing" && (
                        <button className="mini primary" onClick={() => handleRecheck(m)}>
                          处理完成·重查采样时间
                        </button>
                      )}
                    </li>
                  ))}
                  {members.length === 0 && <li className="muted small empty-li">批次中暂无样本</li>}
                </ul>

                <footer className="batch-foot">
                  {b.status === "open" && inBatch.length > 0 && (
                    <button className="primary" onClick={() => handleSeal(b)}>
                      封存批次（{inBatch.length}）
                    </button>
                  )}
                  {b.status === "open" && inBatch.length === 0 && (
                    <button disabled>无待封存样本</button>
                  )}
                  <button className={b.status === "sealed" ? "" : "muted-btn"} onClick={() => handleExport(b)}>
                    {b.status === "sealed" ? "导出封存清单" : "导出已暂停"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>随批次提交</p>
            <h2>可提交样本（鉴定四项齐全）</h2>
          </div>
        </div>
        {readySamples.length === 0 ? (
          <p className="muted">暂无可提交样本——请先在「样本工作台」补齐昆虫种类、发育阶段、鉴定结论、保存方式四项。</p>
        ) : (
          <>
            <div className="submit-bar">
              <select value={submitBatchId} onChange={(e) => setTargetBatch(e.target.value)}>
                <option value="">选择批次…</option>
                {openBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}（{batchStatusLabel(b)}）
                    </option>
                  ))}
              </select>
              <span className="muted small">已选 {picked.size} 个</span>
              <span className="member-spacer" />
              <button onClick={() => setPicked(new Set(readySamples.map((s) => s.id)))}>全选</button>
              <button onClick={() => setPicked(new Set())}>清空</button>
              <button className="primary" onClick={handleSubmit}>
                提交至批次
              </button>
            </div>
            <div className="ready-grid">
              {readySamples.map((s) => (
                <label key={s.id} className={`ready-item ${picked.has(s.id) ? "picked" : ""}`}>
                  <input type="checkbox" checked={picked.has(s.id)} onChange={() => togglePick(s.id)} />
                  <button type="button" className="link-btn" onClick={() => onOpenSample(s)}>
                    {s.code}
                  </button>
                  <span className="muted small">
                    {s.caseId} · {s.location} · {s.stage}
                    {s.stageDetail ? `·${s.stageDetail}` : ""} · {s.temperature.toFixed(1)}℃
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      {report && (
        <Modal title={`封存结果 · ${state.batches.find((b) => b.id === report.batchId)?.name ?? ""}`} onClose={() => setReport(null)}>
          <p className="report-note">{report.note}</p>
          <div className="report-cols">
            <div>
              <h4 className="ok-text">已封存（{report.sealed.length}）</h4>
              <ul>
                {report.sealed.map((s) => (
                  <li key={s.id}>{s.code} · {s.caseId} · {s.location}</li>
                ))}
                {report.sealed.length === 0 && <li className="muted">无</li>}
              </ul>
            </div>
            <div>
              <h4 className="danger-text">冲突退回待复核（{report.rejected.length}）</h4>
              <ul>
                {report.rejected.map((s) => (
                  <li key={s.id}>{s.code} · {s.caseId} · {s.location}</li>
                ))}
                {report.rejected.length === 0 && <li className="muted">无</li>}
              </ul>
            </div>
          </div>
          {report.pairs.length > 0 && (
            <div className="pairs-box">
              <h4>冲突依据（同一案件 · 相同地点 · 采样时间重叠）</h4>
              <ul>
                {report.pairs.map((p, i) => (
                  <li key={i}>{describePair(p, state.samples)}</li>
                ))}
              </ul>
              <p className="muted small">冲突样本已退回待复核，批次内其他样本及原有封存记录不变。</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
