import type { Batch, ConflictPair, Sample, SampleStatus } from "../types";

/** 封存必备的四项：昆虫种类、发育阶段、鉴定结论、保存方式 */
export function isIdentified(s: Pick<Sample, "species" | "stage" | "conclusion" | "preservation">): boolean {
  return (
    s.species.trim() !== "" &&
    s.stage !== "" &&
    s.conclusion.trim() !== "" &&
    s.preservation.trim() !== ""
  );
}

export function statusLabel(status: SampleStatus): string {
  return {
    pending: "待鉴定",
    ready: "可提交",
    in_batch: "批次中",
    reviewing: "待复核",
    sealed: "已封存",
  }[status];
}

export function batchStatusLabel(b: Batch): string {
  if (b.status === "sealed") return "已封存";
  if (b.status === "unsealed") return "已解封·暂停导出";
  return "待封存";
}

function time(v: string): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

/** 两个采样区间是否重叠（端点相接也算重叠：同一时间点不能既开始又结束） */
export function intervalsOverlap(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string
): boolean {
  const af = time(aFrom);
  const at = time(aTo);
  const bf = time(bFrom);
  const bt = time(bTo);
  if ([af, at, bf, bt].some(Number.isNaN)) return false;
  // 非法区间（结束早于开始）视为退化点区间
  const as = Math.min(af, at);
  const ae = Math.max(af, at);
  const bs = Math.min(bf, bt);
  const be = Math.max(bf, bt);
  return as <= be && bs <= ae;
}

/**
 * 在一组候选样本中找出冲突对：
 * 同一案件 + 采样地点相同 + 采样时间重叠。
 */
export function findConflicts(candidates: Sample[]): {
  conflicts: Set<string>;
  pairs: ConflictPair[];
} {
  const conflicts = new Set<string>();
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (
        a.caseId === b.caseId &&
        a.location.trim() === b.location.trim() &&
        a.location.trim() !== "" &&
        intervalsOverlap(a.sampledFrom, a.sampledTo, b.sampledFrom, b.sampledTo)
      ) {
        conflicts.add(a.id);
        conflicts.add(b.id);
        pairs.push({ aId: a.id, bId: b.id });
      }
    }
  }
  return { conflicts, pairs };
}

export function describePair(pair: ConflictPair, samples: Sample[]): string {
  const a = samples.find((s) => s.id === pair.aId);
  const b = samples.find((s) => s.id === pair.bId);
  if (!a || !b) return "";
  return `${a.code} ↔ ${b.code}（${a.caseId} · ${a.location}）`;
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}

/** 平均温度，保留一位小数 */
export function avgTemp(samples: Sample[]): string {
  if (samples.length === 0) return "—";
  return (samples.reduce((sum, s) => sum + s.temperature, 0) / samples.length).toFixed(1);
}
