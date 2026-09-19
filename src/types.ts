export type Stage = "卵" | "幼虫" | "蛹" | "成虫";

export type SampleStatus = "draft" | "inBatch" | "sealed" | "review";

export interface Sample {
  id: string;
  caseId: string; // 案件编号
  location: string; // 采样地点
  temperature: number | null; // 环境温度 ℃
  exposureStage: string; // 尸体暴露阶段
  species: string; // 昆虫种类（封存必填）
  stage: Stage | ""; // 发育阶段（封存必填）
  sampledAt: string; // 采样开始时间 datetime-local
  sampledEnd: string; // 采样结束时间 datetime-local
  preservation: string; // 保存方式（封存必填）
  conclusion: string; // 鉴定结论（封存必填）
  note: string; // 鉴定备注
  batchId: string | null;
  status: SampleStatus;
  reviewReason: string | null; // 待复核原因
  originBatchId: string | null; // 从已封存批次退回时记录原批次，用于恢复封存
}

export interface SealRecord {
  at: string;
  action: "sealed" | "unsealed" | "restored";
  detail: string;
}

export interface Batch {
  id: string;
  name: string;
  createdAt: string;
  sealed: boolean;
  sealedAt: string | null;
  exportPaused: boolean; // 解封期间暂停导出
  records: SealRecord[]; // 封存记录（只追加，不回改）
}

export const STAGES: Stage[] = ["卵", "幼虫", "蛹", "成虫"];

export const STATUS_LABEL: Record<SampleStatus, string> = {
  draft: "待入库",
  inBatch: "待封存",
  sealed: "已封存",
  review: "待复核",
};

/** 随批次提交前必须齐全的四个鉴定字段 */
export const REQUIRED_FIELDS: { key: keyof Sample; label: string }[] = [
  { key: "species", label: "昆虫种类" },
  { key: "stage", label: "发育阶段" },
  { key: "conclusion", label: "鉴定结论" },
  { key: "preservation", label: "保存方式" },
];

export function missingFields(s: Sample): string[] {
  return REQUIRED_FIELDS.filter((f) => !String(s[f.key] ?? "").trim()).map(
    (f) => f.label
  );
}

export function isComplete(s: Sample): boolean {
  return missingFields(s).length === 0;
}

/** 采样时间窗重叠判定（同格式 datetime-local 字符串可直接比较） */
export function timeOverlap(a: Sample, b: Sample): boolean {
  if (!a.sampledAt || !a.sampledEnd || !b.sampledAt || !b.sampledEnd) {
    return false;
  }
  return a.sampledAt < b.sampledEnd && b.sampledAt < a.sampledEnd;
}

/** 冲突规则：同一案件 + 采样时间重叠 + 采样地点相同 */
export function conflictsWith(a: Sample, b: Sample): boolean {
  if (a.id === b.id) return false;
  if (a.caseId.trim() !== b.caseId.trim()) return false;
  if (a.location.trim() !== b.location.trim()) return false;
  return timeOverlap(a, b);
}

export function fmtTime(iso: string): string {
  if (!iso) return "—";
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function fmtRange(s: Sample): string {
  if (!s.sampledAt || !s.sampledEnd) return "—";
  return `${fmtTime(s.sampledAt)} ~ ${fmtTime(s.sampledEnd)}`;
}
