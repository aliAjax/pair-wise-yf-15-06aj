// 将 src/lib/store.ts 及其依赖打包为 ESM，并注入测试辅助导出与 localStorage shim
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const shim = `
const __store = new Map();
globalThis.localStorage = {
  getItem: (k) => (__store.has(k) ? __store.get(k) : null),
  setItem: (k, v) => __store.set(k, String(v)),
  removeItem: (k) => __store.delete(k),
};
`;

const result = await build({
  entryPoints: ["src/lib/store.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});

const helpers = `
export const __state = () => state;
export const __update = (id, patch) => setState({
  ...state,
  samples: state.samples.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});
`;

writeFileSync(
  "scripts/store-bundle.mjs",
  shim + "\n" + result.outputFiles[0].text + "\n" + helpers
);

// 验证脚本（含 TS 领域模块）一并打包
await build({
  entryPoints: ["scripts/verify.mjs"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "scripts/verify-bundle.mjs",
});

console.log("scripts/store-bundle.mjs and scripts/verify-bundle.mjs generated");

