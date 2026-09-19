import { useSyncExternalStore } from "react";
import type { AppState, Batch, ConflictPair, Sample } from "../types";
import { findConflicts, isIdentified, nowStamp, uid } from "./domain";
import { buildSeedState } from "./seed";

const STORAGE_KEY = "forensic-ent-state-v1";

export interface SealReport {
  batchId: string;
  sealed: Sample[];
  rejected: Sample[];
  pairs: ConflictPair[];
  note: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  report?: SealReport;
}

type Listener = () => void;

let state: AppState = loadState();
const listeners = new Set<Listener>();

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.samples) && Array.isArray(parsed.batches)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回退到种子数据
  }
  return buildSeedState();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景忽略写入失败
  }
}

function setState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppState {
  return state;
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------------- 样本编辑 ----------------

type SampleInput = Omit<
  Sample,
  "id" | "status" | "batchId" | "sealedAt"
>;

export function addSample(input: SampleInput): ActionResult {
  const code = input.code.trim() || "未编号样本";
  const s: Sample = {
    ...input,
    code,
    id: uid("s"),
    status: isIdentified(input) ? "ready" : "pending",
    batchId: null,
    sealedAt: null,
  };
  setState({
    ...state,
    cases: state.cases.includes(s.caseId) ? state.cases : [...state.cases, s.caseId],
    samples: [s, ...state.samples],
  });
  return { ok: true, message: `样本 ${code} 已保存（${s.status === "ready" ? "可提交" : "待鉴定"}）` };
}

export function updateSample(id: string, patch: Partial<Sample>): ActionResult {
  const target = state.samples.find((s) => s.id === id);
  if (!target) return { ok: false, message: "样本不存在" };

  const next: Sample = { ...target, ...patch };
  // 仅待鉴定/可提交状态随四项齐全度自动流转；批次相关状态不受编辑影响
  if (next.status === "pending" && isIdentified(next)) next.status = "ready";
  else if (next.status === "ready" && !isIdentified(next)) next.status = "pending";

  setState({
    ...state,
    cases: state.cases.includes(next.caseId) ? state.cases : [...state.cases, next.caseId],
    samples: state.samples.map((s) => (s.id === id ? next : s)),
  });
  return { ok: true, message: `样本 ${next.code} 已更新` };
}

export function deleteSample(id: string): ActionResult {
  const target = state.samples.find((s) => s.id === id);
  if (!target) return { ok: false, message: "样本不存在" };
  if (!["pending", "ready"].includes(target.status)) {
    return { ok: false, message: "仅待鉴定/可提交的样本可以删除" };
  }
  setState({ ...state, samples: state.samples.filter((s) => s.id !== id) });
  return { ok: true, message: `样本 ${target.code} 已删除` };
}

// ---------------- 批次 ----------------

export function createBatch(name: string): ActionResult {
  const trimmed = name.trim() || `BATCH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(state.batches.length + 1).padStart(2, "0")}`;
  const batch: Batch = {
    id: uid("batch"),
    name: trimmed,
    status: "open",
    createdAt: nowStamp(),
    sealedAt: null,
    wasSealed: false,
  };
  setState({ ...state, batches: [batch, ...state.batches] });
  return { ok: true, message: `批次 ${trimmed} 已创建（待封存）` };
}

/** 可提交样本随批次提交：仅鉴定四项齐全且处于「可提交」的样本可提交 */
export function submitToBatch(sampleIds: string[], batchId: string): ActionResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return { ok: false, message: "批次不存在" };
  if (batch.status === "sealed") return { ok: false, message: "批次已封存，不能继续提交样本" };
  if (batch.status === "unsealed")
    return { ok: false, message: "批次已解封并暂停导出，请先完成待复核样本处理与重查，再提交新样本" };

  const ok: string[] = [];
  const bad: string[] = [];
  for (const id of sampleIds) {
    const s = state.samples.find((x) => x.id === id);
    if (!s) continue;
    if (s.status === "ready" && isIdentified(s)) ok.push(id);
    else bad.push(s.code);
  }
  if (ok.length === 0) {
    return { ok: false, message: bad.length ? `样本鉴定信息未齐全，无法提交：${bad.join("、")}` : "没有可提交的样本" };
  }
  setState({
    ...state,
    samples: state.samples.map((s) =>
      ok.includes(s.id) ? { ...s, status: "in_batch", batchId } : s
    ),
  });
  return {
    ok: true,
    message: `已向 ${batch.name} 提交 ${ok.length} 个样本${bad.length ? `；以下样本信息不全被跳过：${bad.join("、")}` : ""}`,
  };
}

/** 从批次撤回（批次未封存时） */
export function withdrawFromBatch(sampleId: string): ActionResult {
  const target = state.samples.find((s) => s.id === sampleId);
  if (!target || target.status !== "in_batch" || !target.batchId) {
    return { ok: false, message: "仅批次中样本可撤回" };
  }
  setState({
    ...state,
    samples: state.samples.map((s) =>
      s.id === sampleId ? { ...s, status: "ready", batchId: null } : s
    ),
  });
  return { ok: true, message: `样本 ${target.code} 已撤回，可重新提交` };
}

/**
 * 封存批次：
 * 候选 = 批次内待封存样本 + 当前所有已封存样本；
 * 同案件 + 同地点 + 采样时间重叠 → 冲突样本退回待复核，其余正常封存；
 * 原批次和已有封存记录不变。
 */
export function sealBatch(batchId: string): ActionResult {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return { ok: false, message: "批次不存在" };
  if (batch.status === "sealed") return { ok: false, message: "批次已封存" };

  const members = state.samples.filter((s) => s.batchId === batchId && s.status === "in_batch");
  if (members.length === 0) return { ok: false, message: "批次中没有可封存的样本" };

  const sealedOthers = state.samples.filter((s) => s.status === "sealed");
  const { conflicts, pairs } = findConflicts([...members, ...sealedOthers]);

  const rejectedIds = new Set(members.filter((m) => conflicts.has(m.id)).map((m) => m.id));
  const sealed = members.filter((m) => !rejectedIds.has(m.id));
  const rejected = members.filter((m) => rejectedIds.has(m.id));
  const stamp = nowStamp();

  if (sealed.length === 0) {
    // 全部冲突：批次保持待封存，冲突样本退回待复核
    setState({
      ...state,
      samples: state.samples.map((s) =>
        rejectedIds.has(s.id) ? { ...s, status: "reviewing" } : s
      ),
    });
    return {
      ok: false,
      message: `批次内 ${rejected.length} 个样本全部存在采样时间/地点冲突，已退回待复核，批次保持待封存，已有封存记录不变`,
      report: { batchId, sealed, rejected, pairs, note: "全部冲突，未执行封存" },
    };
  }

  const sealedIds = new Set(sealed.map((s) => s.id));
  const nextBatches = state.batches.map((b) =>
    b.id === batchId
      ? {
          ...b,
          status: "sealed" as const,
          sealedAt: b.sealedAt ?? stamp,
          wasSealed: true,
        }
      : b
  );
  setState({
    ...state,
    batches: nextBatches,
    samples: state.samples.map((s) => {
      if (sealedIds.has(s.id)) return { ...s, status: "sealed", sealedAt: stamp };
      if (rejectedIds.has(s.id)) return { ...s, status: "reviewing" };
      return s;
    }),
  });

  return {
    ok: true,
    message:
      `批次 ${batch.name}：${sealed.length} 个样本已封存` +
      (rejected.length ? `；${rejected.length} 个冲突样本退回待复核，原批次其余样本及已有封存记录不变` : ""),
    report: {
      batchId,
      sealed,
      rejected,
      pairs,
      note: rejected.length ? "部分样本冲突退回" : "全部封存成功",
    },
  };
}

/**
 * 封存样本被复核退回：
 * 样本转待复核，所在批次立即解封并暂停导出（批次与封存关联保留）。
 */
export function sendSealedToReview(sampleId: string): ActionResult {
  const target = state.samples.find((s) => s.id === sampleId);
  if (!target || target.status !== "sealed" || !target.batchId) {
    return { ok: false, message: "仅已封存样本可复核退回" };
  }
  const batch = state.batches.find((b) => b.id === target.batchId);
  setState({
    ...state,
    batches: state.batches.map((b) =>
      b.id === target.batchId ? { ...b, status: "unsealed" } : b
    ),
    samples: state.samples.map((s) =>
      s.id === sampleId ? { ...s, status: "reviewing" } : s
    ),
  });
  return {
    ok: true,
    message: `样本 ${target.code} 已退回待复核，批次 ${batch?.name ?? ""} 立即解封并暂停导出`,
  };
}

/**
 * 待复核样本处理完成后再查采样时间：
 * 与所有已封存样本比对（同案件 + 同地点 + 时间重叠）。
 * - 批次曾封存（解封暂停导出中）：通过 → 恢复封存；批内无待复核样本时批次恢复已封存。
 * - 批次从未封存（封存时冲突退回）：通过 → 回到批次待封存。
 */
export function recheckReviewSample(sampleId: string): ActionResult {
  const target = state.samples.find((s) => s.id === sampleId);
  if (!target || target.status !== "reviewing" || !target.batchId) {
    return { ok: false, message: "仅待复核样本可执行重查" };
  }
  const batch = state.batches.find((b) => b.id === target.batchId);
  if (!batch) return { ok: false, message: "所在批次不存在" };

  const sealedOthers = state.samples.filter((s) => s.status === "sealed");
  const { conflicts } = findConflicts([target, ...sealedOthers]);

  if (conflicts.has(target.id)) {
    return {
      ok: false,
      message: `重查未通过：样本 ${target.code} 仍与同案件、同地点的已封存样本采样时间重叠，请修改采样时间/地点后再查`,
    };
  }

  if (batch.wasSealed) {
    // 通过 → 恢复封存
    const stamp = nowStamp();
    const remainReviewing = state.samples.some(
      (s) => s.batchId === batch.id && s.status === "reviewing" && s.id !== target.id
    );
    const batchBackSealed = !remainReviewing;
    setState({
      ...state,
      batches: state.batches.map((b) =>
        b.id === batch.id && batchBackSealed
          ? { ...b, status: "sealed" as const }
          : b
      ),
      samples: state.samples.map((s) =>
        s.id === target.id ? { ...s, status: "sealed", sealedAt: s.sealedAt ?? stamp } : s
      ),
    });
    return {
      ok: true,
      message: batchBackSealed
        ? `重查通过，样本 ${target.code} 已恢复封存，批次 ${batch.name} 恢复封存并可导出`
        : `重查通过，样本 ${target.code} 已恢复封存；批次内仍有其他待复核样本，批次保持暂停导出`,
    };
  }

  // 从未封存的批次：回到批次中，等待再次封存
  setState({
    ...state,
    samples: state.samples.map((s) =>
      s.id === target.id ? { ...s, status: "in_batch" } : s
    ),
  });
  return { ok: true, message: `重查通过，样本 ${target.code} 已回到批次 ${batch.name}，可再次封存` };
}

export function resetAll(): ActionResult {
  const seed = buildSeedState();
  setState(seed);
  return { ok: true, message: "已恢复为演示数据" };
}
