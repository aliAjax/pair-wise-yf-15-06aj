import { useState } from "react";
import { REQUIRED_FIELDS, Sample, STAGES, Stage } from "../types";

interface Props {
  initial: Sample;
  isNew: boolean;
  onSave: (s: Sample) => void;
  onClose: () => void;
}

/** 新增 / 编辑样本弹窗。四要素不齐仅影响随批次提交，草稿可随时保存。 */
export default function SampleForm({ initial, isNew, onSave, onClose }: Props) {
  const [form, setForm] = useState<Sample>(initial);
  const [error, setError] = useState("");

  const set = <K extends keyof Sample>(key: K, value: Sample[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    if (!form.caseId.trim()) return setError("请填写案件编号");
    if (!form.location.trim()) return setError("请填写采样地点");
    if (!form.sampledAt || !form.sampledEnd)
      return setError("请填写采样开始与结束时间");
    if (form.sampledEnd < form.sampledAt)
      return setError("采样结束时间不能早于开始时间");
    onSave({
      ...form,
      caseId: form.caseId.trim(),
      location: form.location.trim(),
      species: form.species.trim(),
      preservation: form.preservation.trim(),
      conclusion: form.conclusion.trim(),
    });
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="heading">
          <div>
            <p>{isNew ? "新建样本" : `编辑 ${form.id}`}</p>
            <h2>{isNew ? `新增样本 ${form.id}` : "样本记录"}</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="field-grid">
          <label>
            <span>案件编号 *</span>
            <input
              value={form.caseId}
              onChange={(e) => set("caseId", e.target.value)}
              placeholder="如 CASE-042"
            />
          </label>
          <label>
            <span>采样地点 *</span>
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="如 室外草地"
            />
          </label>
          <label>
            <span>采样开始时间 *</span>
            <input
              type="datetime-local"
              value={form.sampledAt}
              onChange={(e) => set("sampledAt", e.target.value)}
            />
          </label>
          <label>
            <span>采样结束时间 *</span>
            <input
              type="datetime-local"
              value={form.sampledEnd}
              onChange={(e) => set("sampledEnd", e.target.value)}
            />
          </label>
          <label>
            <span>环境温度（℃）</span>
            <input
              type="number"
              step="0.1"
              value={form.temperature ?? ""}
              onChange={(e) =>
                set(
                  "temperature",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              placeholder="如 28.6"
            />
          </label>
          <label>
            <span>尸体暴露阶段</span>
            <input
              value={form.exposureStage}
              onChange={(e) => set("exposureStage", e.target.value)}
              placeholder="如 肿胀期 / 腐败期 / 干化期"
            />
          </label>
          <label>
            <span>昆虫种类（封存必填）</span>
            <input
              value={form.species}
              onChange={(e) => set("species", e.target.value)}
              placeholder="如 丝光绿蝇"
            />
          </label>
          <label>
            <span>发育阶段（封存必填）</span>
            <select
              value={form.stage}
              onChange={(e) => set("stage", e.target.value as Stage | "")}
            >
              <option value="">未填写</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>保存方式（封存必填）</span>
            <input
              value={form.preservation}
              onChange={(e) => set("preservation", e.target.value)}
              placeholder="如 乙醇保存 / 冷冻保存 / 针插保存"
            />
          </label>
          <label>
            <span>鉴定结论（封存必填）</span>
            <input
              value={form.conclusion}
              onChange={(e) => set("conclusion", e.target.value)}
              placeholder="如 三龄幼虫，推断暴露约72小时"
            />
          </label>
          <label className="span-2">
            <span>鉴定备注</span>
            <input
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="其他需要记录的信息"
            />
          </label>
        </div>

        <p className="form-hint">
          随批次提交封存前需齐全：{REQUIRED_FIELDS.map((f) => f.label).join("、")}
          。草稿可先保存，齐全后再提交。
        </p>
        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={submit}>
            {isNew ? "保存样本" : "保存修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
