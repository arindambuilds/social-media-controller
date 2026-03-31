import path from "node:path";

/** Repository root (parent of quadrapilot/). */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const QUADRAPILOT_ROOT = path.join(REPO_ROOT, "quadrapilot");

export function outputPath(configOutputDir: string, ...parts: string[]): string {
  const base = path.isAbsolute(configOutputDir)
    ? configOutputDir
    : path.join(REPO_ROOT, configOutputDir);
  return path.join(base, ...parts);
}
