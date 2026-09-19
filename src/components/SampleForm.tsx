import { useState } from "react";
import type { Sample, Stage } from "../types";
import { addSample, updateSample } from "../lib/store";
import { pushToast } from "../lib/toast";
import { isIdentified } from "../lib/domain";

const STAGES: Stage[] = ["卵", "幼虫", "蛹", "成虫"];
const REQUIRED: Array<{ key: keyof FormState; label: string }> = [
  { key: "species", label: "昆虫种类" },
  { key: "stage", label: "发育阶段" },
  { key: "conclusion", label: "鉴定结论" },
  { key: "preservation", label: "保存方式" },
];

type FormState = Omit<Sample, "id" | "status" | "batchId" | "sealedAt">;

function emptyForm(): FormState {
  return {
    code: "",
    caseId: "",
    location: "",
    temperature: 25,
    exposureStage: "",
    species: "",
    stage: "",
    stageDetail: "",
    preservation: "",
    conclusion: "",
    note: "",
    sampledFrom: "",
    sampledTo: "",
  };
}

export default function SampleForm({ editing, onDone }: { editing: Sample | null; onDone: () => void }) {
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          code: editing.code,
          caseId: editing.caseId,
          location: editing.location,
          temperature: editing.temperature,
          exposureStage: editing.exposureStage,
          species: editing.species,
          stage: editing.stage,
          stageDetail: editing.stageDetail ?? "",
          preservation: editing.preservation,
          conclusion: editing.conclusion,
          note: editing.note,
          sampledFrom: editing.sampledFrom,
          sampledTo: editing.sampledTo,
        }
      : emptyForm()
  );

  const complete = isIdentified(form);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    if (!form.caseId.trim() || !form.location.trim() || !form.sampledFrom || !form.sampledTo) {
      pushToast("请先填写案件编号、采样地点和采样起止时间", false);
      return;
    }
    if (new Date(form.sampledFrom).getTime() > new Date(form.sampledTo).getTime()) {
      pushToast("采样开始时间不能晚于结束时间", false);
      return;
    }
    const result = editing ? updateSample(editing.id, form) : addSample(form);
    pushToast(result.message, result.ok);
    if (result.ok) {
      if (!editing) setForm(emptyForm());
      onDone();
    }
  };

  return (
    <div className="sample-form">
      <div className="completeness">
        <span className={complete ? "badge ok" : "badge warn"}>
          {complete ? "鉴定四项齐全 · 可随批次提交" : "鉴定四项未齐全 · 待鉴定，不可提交"}
        </span>
        <div className="req-list">
          {REQUIRED.map((r) => (
            <span key={r.key} className={form[r.key] !== "" ? "req on" : "req"}>
              {r.label}
            </span>
          ))}
        </div>
      </div>

      <div className="field-grid">
        <label>
          <span>样本编号</span>
          <input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="如 CASE-042-D" />
        </label>
        <label>
          <span>案件编号</span>
          <input value={form.caseId} onChange={(e) => set("caseId", e.target.value)} placeholder="如 CASE-042" />
        </label>
        <label className="wide">
          <span>采样地点</span>
          <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="如 室外草地 / 水沟边缘" />
        </label>
        <label>
          <span>环境温度 ℃</span>
          <input
            type="number"
            step="0.1"
            value={form.temperature}
            onChange={(e) => set("temperature", Number(e.target.value))}
          />
        </label>
        <label>
          <span>尸体暴露阶段</span>
          <input value={form.exposureStage} onChange={(e) => set("exposureStage", e.target.value)} placeholder="新鲜期 / 肿胀期 / 腐烂期 …" />
        </label>
        <label className={form.species === "" ? "missing" : ""}>
          <span>昆虫种类 *</span>
          <input value={form.species} onChange={(e) => set("species", e.target.value)} placeholder="中文名 + 拉丁名" />
        </label>
        <label className={form.stage === "" ? "missing" : ""}>
          <span>发育阶段 *</span>
          <select value={form.stage} onChange={(e) => set("stage", e.target.value as Stage | "")}>
            <option value="">请选择</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>阶段补充（如三龄/初蛹）</span>
          <input value={form.stageDetail} onChange={(e) => set("stageDetail", e.target.value)} />
        </label>
        <label className={form.preservation === "" ? "missing" : ""}>
          <span>保存方式 *</span>
          <input value={form.preservation} onChange={(e) => set("preservation", e.target.value)} placeholder="乙醇浸泡 / 针插 / 冷藏 …" />
        </label>
        <label>
          <span>采样开始时间</span>
          <input type="datetime-local" value={form.sampledFrom} onChange={(e) => set("sampledFrom", e.target.value)} />
        </label>
        <label>
          <span>采样结束时间</span>
          <input type="datetime-local" value={form.sampledTo} onChange={(e) => set("sampledTo", e.target.value)} />
        </label>
        <label className={`wide ${form.conclusion === "" ? "missing" : ""}`}>
          <span>鉴定结论 *</span>
          <textarea
            rows={2}
            value={form.conclusion}
            onChange={(e) => set("conclusion", e.target.value)}
            placeholder="种属鉴定结论与 PMI 分析意见"
          />
        </label>
        <label className="wide">
          <span>鉴定备注</span>
          <textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button className="primary" onClick={submit}>
          {editing ? "保存修改" : "保存样本"}
        </button>
        {editing && <button onClick={onDone}>取消编辑</button>}
      </div>
    </div>
  );
}
