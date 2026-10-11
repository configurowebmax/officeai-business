import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

function runCli(cmd) {
  return JSON.parse(execSync(`univer-workspace-cli ${cmd}`, { encoding: "utf8" }));
}

const wt = runCli('worktree create --name "Inspect Base" --scope user --json').worktree.id;
try {
  const add = runCli(`unit add --worktree ${wt} --resource e34ea0f3-44b5-4fb3-adc3-7ec989072334 --json`);
  const script = `
    const fBase = base;
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(fBase));
    const t = fBase.getTables()[1];
    const tMethods = t ? Object.getOwnPropertyNames(Object.getPrototypeOf(t)) : [];
    return { fBaseMethods: methods, tableMethods: tMethods };
  `;
  writeFileSync("apps/sales-pos/src/temp_test.js", script, "utf8");
  const res = runCli(`execute --worktree ${wt} --unit ${add.unit.unitId} --script "apps/sales-pos/src/temp_test.js" --json`);
  console.log("Result:", JSON.stringify(res.value, null, 2));
} finally {
  try { unlinkSync("apps/sales-pos/src/temp_test.js"); } catch (e) {}
  runCli(`worktree discard ${wt} --json`);
}
