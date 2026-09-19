import type { AppState, Sample, Stage } from "../types";

function sample(partial: Omit<Sample, "batchId" | "sealedAt">): Sample {
  return { batchId: null, sealedAt: null, ...partial };
}

const seeds: Sample[] = [
  // —— 已封存批次 BATCH-0910 中的样本（不同案件、不同地点，互不冲突）——
  sample({
    id: "s-042-a",
    code: "CASE-042-A",
    caseId: "CASE-042",
    location: "室外草地",
    temperature: 28.6,
    exposureStage: "肿胀期",
    species: "丝光绿蝇 Lucilia sericata",
    stage: "幼虫",
    stageDetail: "三龄",
    preservation: "75% 乙醇浸泡",
    conclusion: "丝光绿蝇三龄幼虫，发育积温支持 PMI 约 56 小时",
    note: "现场采集 12 头，体型均一",
    sampledFrom: "2026-09-10T09:00",
    sampledTo: "2026-09-10T11:30",
    status: "sealed",
  }),
  sample({
    id: "s-051-a",
    code: "CASE-051-A",
    caseId: "CASE-051",
    location: "水沟边缘",
    temperature: 24.3,
    exposureStage: "腐烂期",
    species: "大头金蝇 Chrysomya megacephala",
    stage: "成虫",
    stageDetail: "",
    preservation: "昆虫针插标本",
    conclusion: "大头金蝇雌性成虫，已完成形态拍照与翅脉测量",
    note: "已完成拍照",
    sampledFrom: "2026-09-08T14:00",
    sampledTo: "2026-09-08T15:30",
    status: "sealed",
  }),

  // —— 待封存批次 BATCH-0915 中 ——
  sample({
    id: "s-042-b",
    code: "CASE-042-B",
    caseId: "CASE-042",
    location: "阴影区域",
    temperature: 26.1,
    exposureStage: "后腐烂期",
    species: "红头丽蝇 Calliphora vicina",
    stage: "蛹",
    stageDetail: "初蛹",
    preservation: "4 ℃ 冷藏",
    conclusion: "红头丽蝇初蛹，种属形态待复核确认",
    note: "需复核种属",
    sampledFrom: "2026-09-11T08:30",
    sampledTo: "2026-09-11T09:15",
    status: "in_batch",
  }),

  // —— 可提交：与 CASE-051-A 同案、同地点（水沟边缘）、采样时间重叠，同时封存会冲突 ——
  sample({
    id: "s-051-b",
    code: "CASE-051-B",
    caseId: "CASE-051",
    location: "水沟边缘",
    temperature: 24.0,
    exposureStage: "腐烂期",
    species: "厩腐蝇 Muscina stabulans",
    stage: "卵",
    stageDetail: "",
    preservation: "卡氏液固定",
    conclusion: "厩腐蝇卵块，产于水沟北侧泥地",
    note: "卵块约 80 粒",
    sampledFrom: "2026-09-08T15:00",
    sampledTo: "2026-09-08T16:00",
    status: "ready",
  }),

  // —— 待鉴定：鉴定结论缺失，不可提交 ——
  sample({
    id: "s-042-c",
    code: "CASE-042-C",
    caseId: "CASE-042",
    location: "室外草地",
    temperature: 28.9,
    exposureStage: "肿胀期",
    species: "丝光绿蝇 Lucilia sericata",
    stage: "幼虫",
    stageDetail: "二龄",
    preservation: "75% 乙醇浸泡",
    conclusion: "",
    note: "与 CASE-042-A 同地点、时间重叠，封存前注意复核",
    sampledFrom: "2026-09-10T10:30",
    sampledTo: "2026-09-10T12:00",
    status: "pending",
  }),

  // —— 待鉴定：多项缺失 ——
  sample({
    id: "s-063-a",
    code: "CASE-063-A",
    caseId: "CASE-063",
    location: "室内卧室",
    temperature: 22.5,
    exposureStage: "新鲜期",
    species: "",
    stage: "" as Stage | "",
    stageDetail: "",
    preservation: "",
    conclusion: "",
    note: "窗台捕虫网采集，待实验室分拣",
    sampledFrom: "2026-09-12T20:10",
    sampledTo: "2026-09-12T20:50",
    status: "pending",
  }),
];

export function buildSeedState(): AppState {
  return {
    cases: ["CASE-042", "CASE-051", "CASE-063"],
    samples: seeds.map((s) =>
      s.status === "sealed"
        ? { ...s, batchId: "batch-0910", sealedAt: "2026-09-12T10:00:00.000Z" }
        : s.status === "in_batch"
          ? { ...s, batchId: "batch-0915" }
          : s
    ),
    batches: [
      {
        id: "batch-0910",
        name: "BATCH-20260910-01",
        status: "sealed",
        createdAt: "2026-09-12T09:30:00.000Z",
        sealedAt: "2026-09-12T10:00:00.000Z",
        wasSealed: true,
      },
      {
        id: "batch-0915",
        name: "BATCH-20260915-01",
        status: "open",
        createdAt: "2026-09-15T09:00:00.000Z",
        sealedAt: null,
        wasSealed: false,
      },
    ],
  };
}
