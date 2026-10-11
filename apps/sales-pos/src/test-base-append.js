import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runCli(command) {
  const output = execSync(`univer-workspace-cli ${command}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });
  return JSON.parse(output);
}

const baseResourceId = "e34ea0f3-44b5-4fb3-adc3-7ec989072334";

console.log("Creando worktree para test de Base...");
const wtResult = runCli(`worktree create --name "Test Base Sale" --scope user --json`);
const worktreeId = wtResult.worktree.id;

try {
  console.log("Staging base unit...");
  const addResult = runCli(`unit add --worktree ${worktreeId} --resource ${baseResourceId} --json`);
  const unitId = addResult.unit.unitId;

  const script = `
    const fBase = base;
    const table = fBase.getTables()[0];
    table.addRecord({
      "ID Venta": "#4",
      "Cliente": "Laura Sánchez",
      "Producto": "Auriculares Sony WH-1000XM5",
      "Cantidad": 1,
      "Precio Unitario": 349,
      "Total Venta": 349,
      "Fecha": "2026-10-11 11:55"
    }, api.Enum.BaseFieldKeyEnum.Name);

    return {
      recordCount: table.getRecords().length
    };
  `;

  const scriptPath = resolve(__dirname, "../tmp_test_base.js");
  writeFileSync(scriptPath, script, "utf8");

  try {
    const execRes = runCli(`execute --worktree ${worktreeId} --unit ${unitId} --script "${scriptPath}" --json`);
    console.log("Execute result:", execRes);
  } finally {
    try { unlinkSync(scriptPath); } catch (e) {}
  }

  runCli(`worktree ready ${worktreeId} --json`);
  const mergeRes = runCli(`worktree merge ${worktreeId} --json`);
  console.log("Base merge result:", mergeRes.worktree.state);
} catch (err) {
  console.error("Error:", err);
  try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
}
