import fs from "fs/promises";

export async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}
