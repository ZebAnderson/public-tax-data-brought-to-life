import { access, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findFirstFileRecursive(
  rootDir: string,
  predicate: (filePath: string) => boolean
): Promise<string | null> {
  async function walk(dir: string): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(fullPath);
        if (found) return found;
      } else if (entry.isFile()) {
        if (predicate(fullPath)) return fullPath;
      }
    }
    return null;
  }

  return walk(rootDir);
}

export async function dirIsNonEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function fileSizeBytes(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

