// 法医昆虫学样本 —— 补批次鉴定封存 领域类型

/** 发育阶段（筛选维度） */
export type Stage = "卵" | "幼虫" | "蛹" | "成虫";

/**
 * 样本状态：
 * - pending    待鉴定：四项鉴定信息未齐全，不可提交
 * - ready      可提交：鉴定信息齐全，可随批次提交
 * - in_batch   批次中：已提交到批次但批次尚未封存
 * - reviewing  待复核：封存冲突 / 复核退回
 * - sealed     已封存
 */
export type SampleStatus =
  | "pending"
  | "ready"
  | "in_batch"
  | "reviewing"
  | "sealed";

/**
 * 批次状态：
 * - open     待封存（含因冲突一个都没封上的情况）
 * - sealed   已封存，可导出
 * - unsealed 已解封暂停导出（封存样本被复核退回）
 */
export type BatchStatus = "open" | "sealed" | "unsealed";

export interface Sample {
  id: string;
  code: string; // 样本编号，如 CASE-042-A
  caseId: string; // 案件编号
  location: string; // 采样地点
  temperature: number; // 环境温度 ℃
  exposureStage: string; // 尸体暴露阶段
  species: string; // 昆虫种类（封存必备）
  stage: Stage | ""; // 发育阶段（封存必备）
  stageDetail?: string; // 发育阶段补充，如「三龄」
  preservation: string; // 保存方式（封存必备）
  conclusion: string; // 鉴定结论（封存必备）
  note: string; // 鉴定备注
  sampledFrom: string; // 采样开始时间 datetime-local
  sampledTo: string; // 采样结束时间 datetime-local
  status: SampleStatus;
  batchId: string | null;
  sealedAt: string | null;
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  createdAt: string;
  sealedAt: string | null;
  // 复核暂停前是否曾处于已封存状态（决定处理后是否"恢复封存"）
  wasSealed: boolean;
}

export interface AppState {
  cases: string[];
  samples: Sample[];
  batches: Batch[];
}

export interface ConflictPair {
  aId: string;
  bId: string;
}
