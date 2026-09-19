import { useState } from "react";
import {
  Batch,
  Sample,
  STATUS_LABEL,
  fmtRange,
  missingFields,
} from "../types";

interface Props {
  sample: Sample;
  batch: Batch | null;
  openBatches: Batch[];
  onClose: () => void;
  onEdit: (s: Sample) => void;
  onAddToBatch: (sampleId: string, batchId: string) => void;
  onRemoveFromBatch: (sampleId: string) => void;
  onReturn: (sampleId: string) => void;
  onResolve: (sampleId: string) => void;
}

/** 单个样本详情卡片 */
export default function SampleDetail({
  sample,
  batch,
  openBatches,
  onClose,
  onEdit,
  onAddToBatch,
  onRemoveFromBatch,
  onReturn,
  onResolve,
}: Props) {
  const [targetBatch, setTargetBatch] = useState("");
  const missing = missingFields(sample);
  const canEdit = sample.status !== "sealed";

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="heading">
          <div>
            <p>样本详情卡片</p>
            <h2>
              {sample.id}
              <span className={`badge st-${sample.status}`}>
                {STATUS_LABEL[sample.status]}
              </span>
            </h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        {sample.status === "review" && sample.reviewReason && (
          <div className="alert danger">
            <b>待复核：</b>
            {sample.reviewReason}
            {sample.originBatchId && (
              <span>
                {" "}
                （原批次 {sample.originBatchId} 已解封，处理完成并复核通过后恢复封存）
              </span>
            )}
          </div>
        )}
        {missing.length > 0 && (
          <div className="alert warn">
            鉴定信息不齐全，缺少：{missing.join("、")}。齐全后才能随批次提交封存。
          </div>
        )}

        <dl className="detail-grid">
          <div>
            <dt>案件编号</dt>
            <dd>{sample.caseId}</dd>
          </div>
          <div>
            <dt>采样地点</dt>
            <dd>{sample.location}</dd>
          </div>
          <div>
            <dt>采样时间</dt>
            <dd>{fmtRange(sample)}</dd>
          </div>
          <div>
            <dt>环境温度</dt>
            <dd>{sample.temperature !== null ? `${sample.temperature}℃` : "—"}</dd>
          </div>
          <div>
            <dt>尸体暴露阶段</dt>
            <dd>{sample.exposureStage || "—"}</dd>
          </div>
          <div>
            <dt>昆虫种类</dt>
            <dd>{sample.species || "—"}</dd>
          </div>
          <div>
            <dt>发育阶段</dt>
            <dd>{sample.stage || "—"}</dd>
          </div>
          <div>
            <dt>保存方式</dt>
            <dd>{sample.preservation || "—"}</dd>
          </div>
          <div className="span-2">
            <dt>鉴定结论</dt>
            <dd>{sample.conclusion || "—"}</dd>
          </div>
          <div className="span-2">
            <dt>鉴定备注</dt>
            <dd>{sample.note || "—"}</dd>
          </div>
          <div>
            <dt>所属批次</dt>
            <dd>{batch ? `${batch.name}（${batch.id}）` : "未入批次"}</dd>
          </div>
          <div>
            <dt>批次状态</dt>
            <dd>
              {batch
                ? batch.sealed
                  ? `已封存 · ${batch.sealedAt}`
                  : batch.exportPaused
                    ? "已解封 · 暂停导出"
                    : "未封存"
                : "—"}
            </dd>
          </div>
        </dl>

        {batch && batch.records.length > 0 && (
          <div className="records-mini">
            <h3>批次封存记录</h3>
            <ul>
              {batch.records.map((r, i) => (
                <li key={i}>
                  <b>{r.at}</b>{" "}
                  {r.action === "sealed"
                    ? "封存"
                    : r.action === "unsealed"
                      ? "解封"
                      : "恢复封存"}
                  ：{r.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions wrap">
          {canEdit && (
            <button onClick={() => onEdit(sample)}>编辑样本</button>
          )}
          {sample.status === "draft" && openBatches.length > 0 && (
            <span className="inline-join">
              <select
                value={targetBatch}
                onChange={(e) => setTargetBatch(e.target.value)}
              >
                <option value="">选择批次</option>
                {openBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                disabled={!targetBatch}
                onClick={() => onAddToBatch(sample.id, targetBatch)}
              >
                加入批次
              </button>
            </span>
          )}
          {sample.status === "inBatch" && (
            <button onClick={() => onRemoveFromBatch(sample.id)}>移出批次</button>
          )}
          {sample.status === "sealed" && (
            <button className="danger" onClick={() => onReturn(sample.id)}>
              复核退回（批次立即解封）
            </button>
          )}
          {sample.status === "review" && (
            <button className="primary" onClick={() => onResolve(sample.id)}>
              复核处理完成，重查采样时间
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
