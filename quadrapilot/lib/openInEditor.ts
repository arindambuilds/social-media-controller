import { exec } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";

const execAsync = promisify(exec);

export async function openInVsCode(filePaths: string[]): Promise<void> {
  const code = process.env.QUADRAPILOT_CODE_CMD?.trim() || "code";
  for (const p of filePaths) {
    try {
      const shell =
        process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "/bin/bash";
      await execAsync(`${code} "${p.replace(/"/g, '\\"')}"`, { shell });
    } catch {
      console.warn(`⚠️  Could not open in editor: ${p} (is '${code}' on PATH?)`);
    }
  }
}
