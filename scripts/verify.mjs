// 端到端业务规则验证（不参与前端构建）
import { buildSeedState } from "../src/lib/seed";
import { findConflicts, intervalsOverlap } from "../src/lib/domain";

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log("  ✓", msg);
  } else {
    fail++;
    console.error("  ✗", msg);
  }
}

// ---------- 区间重叠 ----------
console.log("采样时间重叠判定");
assert(intervalsOverlap("2026-09-08T14:00", "2026-09-08T15:30", "2026-09-08T15:00", "2026-09-08T16:00"), "重叠区间应判为冲突");
assert(intervalsOverlap("2026-09-08T14:00", "2026-09-08T15:00", "2026-09-08T15:00", "2026-09-08T16:00"), "端点相接也算重叠");
assert(!intervalsOverlap("2026-09-08T14:00", "2026-09-08T15:00", "2026-09-08T16:00", "2026-09-08T17:00"), "不重叠区间不冲突");

// ---------- 冲突组：同案+同地点+时间重叠 ----------
const seed = buildSeedState();
console.log("种子数据冲突组");
const { conflicts, pairs } = findConflicts([...seed.samples.filter((s) => s.status === "in_batch" || s.status === "ready"), ...seed.samples.filter((s) => s.status === "sealed")]);
assert(conflicts.has("s-051-b"), "CASE-051-B 与已封存的 CASE-051-A 同地点+时间重叠 → 冲突");
assert(!conflicts.has("s-042-b"), "CASE-042-B 与他人地点不同 → 不冲突");
assert(pairs.some((p) => [p.aId, p.bId].sort().join("|") === ["s-051-a", "s-051-b"].sort().join("|")), "冲突对 051-A ↔ 051-B 被识别");

// ---------- store 工作流（动态导入打包后的 bundle 操作 localStorage 持久化模块） ----------
const store = await import("./store-bundle.mjs");

function byCode(code) {
  return store.__state().samples.find((s) => s.code === code);
}
function batchOf(sampleId) {
  const s = store.__state().samples.find((x) => x.id === sampleId);
  return store.__state().batches.find((b) => b.id === s.batchId);
}

console.log("封存：成功 + 冲突退回，原封存记录不变");
store.resetAll();
let sealedACountBefore = store.__state().samples.filter((s) => s.status === "sealed").length;
let r = store.submitToBatch(["s-051-b", "s-042-c"], "batch-0915");
assert(r.ok && r.message.includes("信息不全被跳过"), "鉴定结论缺失的 CASE-042-C 被跳过，仅 051-B 提交");
r = store.sealBatch("batch-0915");
assert(r.report.rejected.length === 1 && r.report.sealed.length === 1, "封存报告：1 个封存成功 + 051-B 冲突退回");
const b051 = byCode("CASE-051-B");
assert(b051.status === "reviewing", "CASE-051-B 已退回待复核");
const b042b = byCode("CASE-042-B");
if (b042b.status === "sealed") {
  assert(true, "CASE-042-B 正常封存");
} else {
  // 若 051-B 提交失败导致批次仍只有 042-B，封存也应成功
  r = store.sealBatch("batch-0915");
  assert(byCode("CASE-042-B").status === "sealed", "CASE-042-B 补封存成功");
}
const batch0915 = store.__state().batches.find((b) => b.id === "batch-0915");
assert(batch0915.status === "sealed", "批次在有样本封存成功后为已封存");
const a051 = byCode("CASE-051-A");
assert(a051.status === "sealed", "原有封存记录 CASE-051-A 不变");
assert(store.__state().samples.filter((s) => s.status === "sealed").length === sealedACountBefore + 1, "封存总数仅 +1（冲突样本未封存）");

console.log("重查未通过：保持待复核");
r = store.recheckReviewSample(b051.id);
assert(!r.ok && byCode("CASE-051-B").status === "reviewing", "采样时间未修改时重查不通过");

console.log("修改采样时间后重查通过 → 恢复封存（该批次已封存过）");
store.__update(b051.id, { sampledFrom: "2026-09-09T09:00", sampledTo: "2026-09-09T10:00" });
r = store.recheckReviewSample(b051.id);
assert(r.ok, "错开时间后重查通过");
assert(byCode("CASE-051-B").status === "sealed", "CASE-051-B 恢复封存");

console.log("封存样本复核退回 → 批次立即解封、暂停导出");
store.resetAll();
r = store.sendSealedToReview("s-051-a");
assert(r.ok, "封存样本可复核退回");
const batch0910 = store.__state().batches.find((b) => b.id === "batch-0910");
assert(batch0910.status === "unsealed", "所在批次立即解封");
assert(byCode("CASE-051-A").status === "reviewing", "样本转待复核");
assert(byCode("CASE-042-A").status === "sealed", "批内其他封存样本保持已封存");

console.log("解封批次暂停接收新样本");
r = store.submitToBatch(["s-051-b"], "batch-0910");
assert(!r.ok, "已解封批次拒绝提交新样本");

console.log("处理后重查通过 → 样本恢复封存且批次恢复封存/导出");
store.__update("s-051-a", { location: "水沟南岸" }); // 改变地点消除冲突
r = store.recheckReviewSample("s-051-a");
assert(r.ok, "重查通过");
assert(byCode("CASE-051-A").status === "sealed", "样本恢复封存");
const restored = store.__state().batches.find((b) => b.id === "batch-0910");
assert(restored.status === "sealed", "批内无待复核样本时批次恢复已封存");

console.log("从未封存批次的冲突样本：重查通过 → 回到批次待封存（而非直接封存）");
store.resetAll();
const cb2 = store.createBatch("BATCH-FRESH-01");
const freshId = store.__state().batches.find((b) => b.name === "BATCH-FRESH-01").id;
store.submitToBatch(["s-051-b"], freshId);
r = store.sealBatch(freshId);
assert(r.report.sealed.length === 0 && r.report.rejected.length === 1, "全新批次内样本全部冲突，未执行封存");
const freshBatch = store.__state().batches.find((b) => b.id === freshId);
assert(byCode("CASE-051-B").status === "reviewing", "冲突样本待复核（原批次不变）");
assert(freshBatch.status === "open" && freshBatch.wasSealed === false, "批次仍为待封存（wasSealed=false）");
store.__update("s-051-b", { sampledFrom: "2026-09-07T08:00", sampledTo: "2026-09-07T09:00" });
r = store.recheckReviewSample("s-051-b");
assert(byCode("CASE-051-B").status === "in_batch", "重查通过后回到批次中（不直接封存）");
r = store.sealBatch(freshId);
assert(r.ok && byCode("CASE-051-B").status === "sealed", "再次封存成功");

console.log("全部冲突：批次保持待封存，已有封存记录不变");
store.resetAll();
const sealedBefore = store.__state().samples.filter((s) => s.status === "sealed").length;
// 构造一个与 042-A 完全冲突的新批次场景：直接把新样本提交到新批次
const add = store.addSample({
  code: "CASE-042-D", caseId: "CASE-042", location: "室外草地", temperature: 27,
  exposureStage: "肿胀期", species: "家蝇 Musca domestica", stage: "卵", stageDetail: "",
  preservation: "卡氏液固定", conclusion: "家蝇卵", note: "",
  sampledFrom: "2026-09-10T10:00", sampledTo: "2026-09-10T11:00",
});
const newId = store.__state().samples.find((s) => s.code === "CASE-042-D").id;
const cb = store.createBatch("BATCH-CONFLICT-ALL");
const newBatchId = store.__state().batches[0].id;
store.submitToBatch([newId], newBatchId);
r = store.sealBatch(newBatchId);
assert(!r.ok && r.report.sealed.length === 0, "全部冲突时封存不执行");
assert(store.__state().batches.find((b) => b.id === newBatchId).status === "open", "批次保持待封存");
assert(store.__state().samples.filter((s) => s.status === "sealed").length === sealedBefore, "已有封存记录数量不变");
assert(store.__state().samples.find((s) => s.id === newId).status === "reviewing", "冲突样本退回待复核");

console.log("四项不齐：不可提交");
store.resetAll();
r = store.submitToBatch(["s-063-a", "s-042-c"], "batch-0915");
assert(!r.ok, "待鉴定样本不能随批次提交");
assert(byCode("CASE-063-A").status === "pending" && byCode("CASE-042-C").status === "pending", "样本保持待鉴定");

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
