import { execSync } from "node:child_process";
import process from "node:process";

export function copyToClipboard(text: string): void {
  try {
    if (process.platform === "win32") {
      execSync("clip", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return;
    }
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
      return;
    }
    execSync("xclip -selection clipboard", { input: text, stdio: ["pipe", "ignore", "ignore"] });
  } catch {
    console.warn("⚠️  Could not copy to clipboard (install xclip on Linux or use WSL).");
  }
}
