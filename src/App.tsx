import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import {
  Batch,
  Sample,
  SampleStatus,
  STAGES,
  STATUS_LABEL,
  Stage,
  conflictsWith,
  fmtRange,
  fmtTime,
  isComplete,
  missingFields,
} from "./types";
import { seedBatches, seedSamples } from "./seed";
import SampleForm from "./components/SampleForm";
import SampleDetail from "./components/SampleDetail";
import TemperatureChart from "./components/TemperatureChart";

const LS_SAMPLES = "hxy62003.samples.v1";
const LS_BATCHES = "hxy62003.batches.v1";

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* 本地数据损坏时回退种子数据 */
  }
  return fallback();
}

function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function nextSampleId(list: Sample[]): string {
  const nums = list
    .map((s) => /^S-(\d+)$/.exec(s.id)?.[1])
    .filter((v): v is string => Boolean(v))
    .map(Number);
  return `S-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;
}

function nextBatchId(list: Batch[]): string {
  const nums = list
    .map((b) => /^B-(\d+)$/.exec(b.id)?.[1])
    .filter((v): v is string => Boolean(v))
    .map(Number);
  return `B-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0")}`;
}

type TabKey = "samples" | "batches" | "cases" | "temp";

const TABS: { key: TabKey; label: string }[] = [
  { key: "samples", label: "样本记录" },
  { key: "batches", label: "批次封存" },
  { key: "cases", label: "案件关联" },
  { key: "temp", label: "温度记录图" },
];

function App() {
  const [samples, setSamples] = useState<Sample[]>(() =>
    load(LS_SAMPLES, seedSamples)
  );
  const [batches, setBatches] = useState<Batch[]>(() =>
    load(LS_BATCHES, seedBatches)
  );
  const [tab, setTab] = useState<TabKey>("samples");
  const [stageFilter, setStageFilter] = useState<"全部" | Stage>("全部");
  const [statusFilter, setStatusFilter] = useState<"全部" | SampleStatus>("全部");
  const [tempCase, setTempCase] = useState<string>("全部");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ sample: Sample; isNew: boolean } | null>(null);
  const [newBatchName, setNewBatchName] = useState("");
  const [batchPick, setBatchPick] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  /* 本地持久化：任何变更立即写入 localStorage，刷新后仍在 */
  useEffect(() => {
    localStorage.setItem(LS_SAMPLES, JSON.stringify(samples));
  }, [samples]);
  useEffect(() => {
    localStorage.setItem(LS_BATCHES, JSON.stringify(batches));
  }, [batches]);

  function notify(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4500);
  }

  /* ---------- 指标（所有视图共享同一份状态，天然同步） ---------- */
  const avgTemp = useMemo(() => {
    const t = samples
      .filter((s) => s.temperature !== null)
      .map((s) => s.temperature!);
    return t.length ? (t.reduce((a, b) => a + b, 0) / t.length).toFixed(1) : "—";
  }, [samples]);
  const stageCount = useMemo(
    () => new Set(samples.filter((s) => s.stage).map((s) => s.stage)).size,
    [samples]
  );
  const incompleteCount = samples.filter((s) => !isComplete(s)).length;
  const reviewCount = samples.filter((s) => s.status === "review").length;
  const caseIds = useMemo(
    () => Array.from(new Set(samples.map((s) => s.caseId))).sort(),
    [samples]
  );

  /* ---------- 样本操作 ---------- */

  function openNewForm() {
    setFormState({
      isNew: true,
      sample: {
        id: nextSampleId(samples),
        caseId: "",
        location: "",
        temperature: null,
        exposureStage: "",
        species: "",
        stage: "",
        sampledAt: "",
        sampledEnd: "",
        preservation: "",
        conclusion: "",
        note: "",
        batchId: null,
        status: "draft",
        reviewReason: null,
        originBatchId: null,
      },
    });
  }

  function saveSample(s: Sample, isNew: boolean) {
    setSamples((prev) =>
      isNew ? [...prev, s] : prev.map((x) => (x.id === s.id ? s : x))
    );
    setFormState(null);
    notify(isNew ? `样本 ${s.id} 已保存` : `样本 ${s.id} 已更新`);
  }

  function addToBatch(sampleId: string, batchId: string) {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || batch.sealed) return notify("目标批次不可接收样本");
    setSamples((prev) =>
      prev.map((s) =>
        s.id === sampleId ? { ...s, batchId, status: "inBatch" } : s
      )
    );
    setDetailId(null);
    notify(`样本 ${sampleId} 已加入批次 ${batch.name}`);
  }

  function removeFromBatch(sampleId: string) {
    const s = samples.find((x) => x.id === sampleId);
    const batch = batches.find((b) => b.id === s?.batchId);
    if (!s || !batch || batch.sealed) return notify("已封存批次不可调整样本");
    setSamples((prev) =>
      prev.map((x) =>
        x.id === sampleId ? { ...x, batchId: null, status: "draft" } : x
      )
    );
    setDetailId(null);
    notify(`样本 ${sampleId} 已移出批次 ${batch.name}`);
  }

  /* ---------- 批次提交封存 ---------- */

  function submitBatch(batchId: string) {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch || batch.sealed) return;
    const members = samples.filter((s) => s.batchId === batchId);
    if (members.length === 0) return notify("批次内没有样本，无法提交封存");

    // 规则一：四要素齐全才能随批次提交
    const incomplete = members.filter((s) => !isComplete(s));
    if (incomplete.length > 0) {
      return notify(
        `提交被拦截：${incomplete
          .map((s) => `${s.id}（缺 ${missingFields(s).join("、")}）`)
          .join("；")}`
      );
    }

    // 规则二：同案件 + 采样时间重叠 + 同地点的样本不得同时封存
    const sealedOthers = samples.filter(
      (s) => s.status === "sealed" && s.batchId !== batchId
    );
    const conflicted = new Map<string, string>();
    for (const s of members) {
      for (const o of members) {
        if (conflictsWith(s, o)) {
          conflicted.set(
            s.id,
            `与同批次样本 ${o.id} 冲突：同案件 ${s.caseId}、同地点「${s.location}」、采样时间重叠`
          );
        }
      }
      for (const o of sealedOthers) {
        if (conflictsWith(s, o)) {
          conflicted.set(
            s.id,
            `与已封存样本 ${o.id} 冲突：同案件 ${s.caseId}、同地点「${s.location}」、采样时间重叠`
          );
        }
      }
    }
    if (conflicted.size > 0) {
      // 冲突样本退回待复核；原批次与封存记录保持不变
      setSamples((prev) =>
        prev.map((s) =>
          conflicted.has(s.id)
            ? {
                ...s,
                status: "review",
                batchId: null,
                originBatchId: null,
                reviewReason: conflicted.get(s.id)!,
              }
            : s
        )
      );
      return notify(
        `发现 ${conflicted.size} 份冲突样本（${Array.from(conflicted.keys()).join(
          "、"
        )}），已退回待复核；原批次与封存记录不变`
      );
    }

    // 通过校验：封存批次
    const now = nowStr();
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              sealed: true,
              sealedAt: now,
              exportPaused: false,
              records: [
                ...b.records,
                {
                  at: now,
                  action: "sealed",
                  detail: `提交封存：${members.length} 份样本鉴定齐全，冲突检测通过`,
                },
              ],
            }
          : b
      )
    );
    setSamples((prev) =>
      prev.map((s) => (s.batchId === batchId ? { ...s, status: "sealed" } : s))
    );
    notify(`批次 ${batch.name} 已封存，共 ${members.length} 份样本`);
  }

  /* ---------- 复核退回：批次立即解封并暂停导出 ---------- */

  function returnSealedSample(sampleId: string) {
    const s = samples.find((x) => x.id === sampleId);
    if (!s || s.status !== "sealed" || !s.batchId) return;
    const batchId = s.batchId;
    const now = nowStr();
    setSamples((prev) =>
      prev.map((x) => {
        if (x.id === sampleId) {
          return {
            ...x,
            status: "review",
            originBatchId: batchId,
            reviewReason: "复核退回：需重新核验采样时间与鉴定信息",
          };
        }
        if (x.batchId === batchId && x.status === "sealed") {
          return { ...x, status: "inBatch" };
        }
        return x;
      })
    );
    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              sealed: false,
              exportPaused: true,
              records: [
                ...b.records,
                {
                  at: now,
                  action: "unsealed",
                  detail: `样本 ${sampleId} 被复核退回，批次立即解封并暂停导出`,
                },
              ],
            }
          : b
      )
    );
    setDetailId(null);
    notify(`样本 ${sampleId} 已退回待复核，批次 ${batchId} 解封并暂停导出`);
  }

  /* ---------- 复核处理：再查采样时间，通过才恢复封存 ---------- */

  function resolveReview(sampleId: string) {
    const s = samples.find((x) => x.id === sampleId);
    if (!s || s.status !== "review") return;

    // 重查采样时间：不得与在批 / 已封存样本冲突
    const blockers = samples.filter(
      (o) =>
        o.id !== s.id &&
        (o.status === "sealed" || o.status === "inBatch") &&
        conflictsWith(s, o)
    );
    if (blockers.length > 0) {
      return notify(
        `复核未通过：与 ${blockers
          .map((b) => b.id)
          .join("、")} 采样时间重叠且地点相同，保持待复核`
      );
    }

    const origin = s.originBatchId
      ? batches.find((b) => b.id === s.originBatchId)
      : null;

    if (!origin) {
      // 提交时被拦截的样本：复核通过后回到待入库
      setSamples((prev) =>
        prev.map((x) =>
          x.id === sampleId
            ? { ...x, status: "draft", reviewReason: null, originBatchId: null }
            : x
        )
      );
      setDetailId(null);
      return notify(`样本 ${sampleId} 复核通过，已回到待入库`);
    }

    // 从已封存批次退回的样本：回到原批次
    const rejoined: Sample = {
      ...s,
      status: "inBatch",
      batchId: origin.id,
      reviewReason: null,
      originBatchId: null,
    };
    const after = samples.map((x) => (x.id === sampleId ? rejoined : x));
    const members = after.filter((x) => x.batchId === origin.id);

    // 批次内全部归位且鉴定齐全、无冲突，才能恢复封存
    const allReady =
      members.length > 0 &&
      members.every((x) => x.status === "inBatch" && isComplete(x));
    let canRestore = allReady;
    if (canRestore) {
      const sealedOthers = after.filter(
        (x) => x.status === "sealed" && x.batchId !== origin.id
      );
      outer: for (const m of members) {
        for (const o of members) if (conflictsWith(m, o)) { canRestore = false; break outer; }
        for (const o of sealedOthers) if (conflictsWith(m, o)) { canRestore = false; break outer; }
      }
    }

    const now = nowStr();
    if (canRestore) {
      setSamples(
        after.map((x) =>
          x.batchId === origin.id ? { ...x, status: "sealed" } : x
        )
      );
      setBatches((prev) =>
        prev.map((b) =>
          b.id === origin.id
            ? {
                ...b,
                sealed: true,
                sealedAt: b.sealedAt ?? now,
                exportPaused: false,
                records: [
                  ...b.records,
                  {
                    at: now,
                    action: "restored",
                    detail: `样本 ${sampleId} 复核处理完成，采样时间检测通过，恢复封存并恢复导出`,
                  },
                ],
              }
            : b
        )
      );
      notify(`样本 ${sampleId} 复核通过，批次 ${origin.name} 已恢复封存`);
    } else {
      setSamples(after);
      notify(
        `样本 ${sampleId} 已回到批次 ${origin.name}，待批次内其余样本处理完成后方可恢复封存`
      );
    }
    setDetailId(null);
  }

  /* ---------- 批次与导出 ---------- */

  function createBatch() {
    const name = newBatchName.trim();
    if (!name) return notify("请填写批次名称");
    const batch: Batch = {
      id: nextBatchId(batches),
      name,
      createdAt: nowStr(),
      sealed: false,
      sealedAt: null,
      exportPaused: false,
      records: [],
    };
    setBatches((prev) => [...prev, batch]);
    setNewBatchName("");
    notify(`批次 ${name}（${batch.id}）已创建`);
  }

  function exportBatch(batchId: string) {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    if (!batch.sealed || batch.exportPaused) {
      return notify("批次未封存或已暂停导出，无法导出");
    }
    const members = samples.filter((s) => s.batchId === batchId);
    const payload = {
      batch: { ...batch, statusLabel: "已封存" },
      exportedAt: nowStr(),
      samples: members,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.id}-封存导出.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`批次 ${batch.name} 已导出 ${members.length} 份样本`);
  }

  function resetDemo() {
    localStorage.removeItem(LS_SAMPLES);
    localStorage.removeItem(LS_BATCHES);
    setSamples(seedSamples());
    setBatches(seedBatches());
    setDetailId(null);
    setFormState(null);
    notify("已重置为演示数据");
  }

  /* ---------- 视图数据 ---------- */

  const filteredSamples = samples.filter(
    (s) =>
      (stageFilter === "全部" || s.stage === stageFilter) &&
      (statusFilter === "全部" || s.status === statusFilter)
  );
  const detailSample = detailId
    ? samples.find((s) => s.id === detailId) ?? null
    : null;
  const openBatches = batches.filter((b) => !b.sealed);
  const tempSamples =
    tempCase === "全部" ? samples : samples.filter((s) => s.caseId === tempCase);

  function batchStatusLabel(b: Batch): string {
    if (b.sealed) return "已封存";
    if (b.exportPaused) return "已解封 · 暂停导出";
    return "未封存";
  }

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62003 · 法医昆虫学 · 批次鉴定封存</p>
        <h1>法医昆虫学样本记录</h1>
        <span>
          记录采样地点、环境温度、暴露阶段、昆虫种类、发育阶段、采样时间、保存方式与鉴定结论。
          样本鉴定信息齐全后才能随批次提交封存；同一案件内采样时间重叠且地点相同的样本不得同时封存，
          冲突样本退回待复核；封存样本被复核退回时批次立即解封并暂停导出，处理后重查采样时间，通过才恢复封存。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>样本批次</small>
          <strong>{batches.length}</strong>
        </article>
        <article>
          <small>平均温度</small>
          <strong>{avgTemp === "—" ? "—" : `${avgTemp}℃`}</strong>
        </article>
        <article>
          <small>发育阶段</small>
          <strong>{stageCount} 类</strong>
        </article>
        <article>
          <small>待鉴定</small>
          <strong>{incompleteCount}</strong>
        </article>
        <article>
          <small>待复核</small>
          <strong className={reviewCount > 0 ? "warn-num" : ""}>{reviewCount}</strong>
        </article>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button className="tab reset" onClick={resetDemo}>
          重置演示数据
        </button>
      </nav>

      {/* ================= 样本记录 ================= */}
      {tab === "samples" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>发育阶段筛选</p>
              <h2>样本列表</h2>
            </div>
            <button className="primary" onClick={openNewForm}>
              新增样本
            </button>
          </div>

          <div className="chips">
            {(["全部", ...STAGES] as const).map((s) => (
              <button
                key={s}
                className={stageFilter === s ? "chip active" : "chip"}
                onClick={() => setStageFilter(s)}
              >
                {s}
              </button>
            ))}
            <span className="chip-sep" />
            {(["全部", "draft", "inBatch", "sealed", "review"] as const).map((s) => (
              <button
                key={s}
                className={statusFilter === s ? "chip active" : "chip"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "全部" ? "全部状态" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>案件</th>
                  <th>采样地点</th>
                  <th>昆虫种类</th>
                  <th>发育阶段</th>
                  <th>温度</th>
                  <th>采样时间</th>
                  <th>状态</th>
                  <th>鉴定信息</th>
                  <th>批次</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSamples.map((s) => {
                  const missing = missingFields(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <b>{s.id}</b>
                      </td>
                      <td>{s.caseId}</td>
                      <td>{s.location}</td>
                      <td>{s.species || "—"}</td>
                      <td>{s.stage || "—"}</td>
                      <td>{s.temperature !== null ? `${s.temperature}℃` : "—"}</td>
                      <td className="nowrap">{fmtRange(s)}</td>
                      <td>
                        <span className={`badge st-${s.status}`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      </td>
                      <td>
                        {missing.length === 0 ? (
                          <span className="ok">齐全</span>
                        ) : (
                          <span className="lack">缺：{missing.join("、")}</span>
                        )}
                      </td>
                      <td>{s.batchId ?? "—"}</td>
                      <td>
                        <button className="small" onClick={() => setDetailId(s.id)}>
                          详情
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSamples.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty">
                      当前筛选条件下没有样本
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ================= 批次封存 ================= */}
      {tab === "batches" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>提交封存 · 复核解封 · 恢复封存</p>
              <h2>批次列表</h2>
            </div>
            <span className="inline-join">
              <input
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                placeholder="新批次名称"
              />
              <button className="primary" onClick={createBatch}>
                创建批次
              </button>
            </span>
          </div>

          <div className="batch-list">
            {batches.map((b) => {
              const members = samples.filter((s) => s.batchId === b.id);
              const incomplete = members.filter((s) => !isComplete(s));
              return (
                <article key={b.id} className="batch-card">
                  <div className="batch-head">
                    <div>
                      <h3>
                        {b.name}
                        <span
                          className={`badge ${
                            b.sealed
                              ? "st-sealed"
                              : b.exportPaused
                                ? "st-review"
                                : "st-inBatch"
                          }`}
                        >
                          {batchStatusLabel(b)}
                        </span>
                      </h3>
                      <p className="meta">
                        {b.id} · 创建于 {b.createdAt}
                        {b.sealedAt ? ` · 封存于 ${b.sealedAt}` : ""} ·{" "}
                        {members.length} 份样本
                      </p>
                    </div>
                    <div className="batch-actions">
                      {!b.sealed && (
                        <button
                          className="primary"
                          onClick={() => submitBatch(b.id)}
                          disabled={members.length === 0}
                        >
                          提交封存
                        </button>
                      )}
                      <button
                        onClick={() => exportBatch(b.id)}
                        disabled={!b.sealed || b.exportPaused}
                        title={
                          !b.sealed || b.exportPaused
                            ? "批次未封存或已暂停导出"
                            : "导出封存样本 JSON"
                        }
                      >
                        {b.exportPaused && !b.sealed ? "已暂停导出" : "导出"}
                      </button>
                    </div>
                  </div>

                  {incomplete.length > 0 && !b.sealed && (
                    <div className="alert warn">
                      待补鉴定：{incomplete.map((s) => s.id).join("、")}
                      ，齐全后才能随批次提交。
                    </div>
                  )}

                  <div className="member-chips">
                    {members.map((s) => (
                      <button
                        key={s.id}
                        className={`member ${isComplete(s) ? "" : "lack"}`}
                        onClick={() => setDetailId(s.id)}
                        title={`${s.id} · ${s.caseId} · ${s.location}`}
                      >
                        {s.id} · {s.stage || "未定"}
                      </button>
                    ))}
                    {members.length === 0 && (
                      <span className="empty">暂无样本，可在样本详情中加入</span>
                    )}
                  </div>

                  {!b.sealed && (
                    <div className="inline-join">
                      <select
                        value={batchPick[b.id] ?? ""}
                        onChange={(e) =>
                          setBatchPick((p) => ({ ...p, [b.id]: e.target.value }))
                        }
                      >
                        <option value="">选择待入库样本</option>
                        {samples
                          .filter((s) => s.status === "draft")
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.id} · {s.caseId} · {s.location}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!batchPick[b.id]}
                        onClick={() => {
                          addToBatch(batchPick[b.id], b.id);
                          setBatchPick((p) => ({ ...p, [b.id]: "" }));
                        }}
                      >
                        加入批次
                      </button>
                    </div>
                  )}

                  {b.records.length > 0 && (
                    <ul className="timeline">
                      {b.records.map((r, i) => (
                        <li key={i} className={`tl-${r.action}`}>
                          <b>{r.at}</b>
                          <span>
                            {r.action === "sealed"
                              ? "封存"
                              : r.action === "unsealed"
                                ? "解封"
                                : "恢复封存"}
                            ：{r.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
            {batches.length === 0 && <p className="empty">暂无批次，请先创建</p>}
          </div>
        </section>
      )}

      {/* ================= 案件关联 ================= */}
      {tab === "cases" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>案件 · 样本 · 批次关联</p>
              <h2>案件样本关联</h2>
            </div>
          </div>
          <div className="case-list">
            {caseIds.map((cid) => {
              const list = samples.filter((s) => s.caseId === cid);
              const batchIds = Array.from(
                new Set(list.map((s) => s.batchId).filter((v): v is string => !!v))
              );
              const pairs: [Sample, Sample][] = [];
              for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                  if (conflictsWith(list[i], list[j])) pairs.push([list[i], list[j]]);
                }
              }
              return (
                <article key={cid} className="case-card">
                  <div className="batch-head">
                    <div>
                      <h3>{cid}</h3>
                      <p className="meta">
                        {list.length} 份样本 · 关联批次：
                        {batchIds.length ? batchIds.join("、") : "无"}
                      </p>
                    </div>
                  </div>
                  {pairs.length > 0 && (
                    <div className="alert danger">
                      {pairs.map(([a, b]) => (
                        <div key={`${a.id}-${b.id}`}>
                          ⚠ {a.id} 与 {b.id}：同地点「{a.location}
                          」且采样时间重叠（{fmtRange(a)} / {fmtRange(b)}
                          ），不得同时封存
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>编号</th>
                          <th>采样地点</th>
                          <th>采样时间</th>
                          <th>发育阶段</th>
                          <th>状态</th>
                          <th>批次</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <b>{s.id}</b>
                            </td>
                            <td>{s.location}</td>
                            <td className="nowrap">{fmtRange(s)}</td>
                            <td>{s.stage || "—"}</td>
                            <td>
                              <span className={`badge st-${s.status}`}>
                                {STATUS_LABEL[s.status]}
                              </span>
                            </td>
                            <td>{s.batchId ?? "—"}</td>
                            <td>
                              <button className="small" onClick={() => setDetailId(s.id)}>
                                详情
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= 温度记录图 ================= */}
      {tab === "temp" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>环境温度曲线</p>
              <h2>温度记录图</h2>
            </div>
            <select value={tempCase} onChange={(e) => setTempCase(e.target.value)}>
              <option value="全部">全部案件</option>
              {caseIds.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <TemperatureChart samples={tempSamples} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>案件</th>
                  <th>采样地点</th>
                  <th>环境温度</th>
                  <th>采样时间</th>
                </tr>
              </thead>
              <tbody>
                {tempSamples
                  .slice()
                  .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt))
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.id}</b>
                      </td>
                      <td>{s.caseId}</td>
                      <td>{s.location}</td>
                      <td>{s.temperature !== null ? `${s.temperature}℃` : "—"}</td>
                      <td className="nowrap">{fmtTime(s.sampledAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 弹窗与提示 */}
      {formState && (
        <SampleForm
          initial={formState.sample}
          isNew={formState.isNew}
          onSave={(s) => saveSample(s, formState.isNew)}
          onClose={() => setFormState(null)}
        />
      )}
      {detailSample && (
        <SampleDetail
          sample={detailSample}
          batch={batches.find((b) => b.id === detailSample.batchId) ?? null}
          openBatches={openBatches}
          onClose={() => setDetailId(null)}
          onEdit={(s) => {
            setDetailId(null);
            setFormState({ sample: s, isNew: false });
          }}
          onAddToBatch={addToBatch}
          onRemoveFromBatch={removeFromBatch}
          onReturn={returnSealedSample}
          onResolve={resolveReview}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
