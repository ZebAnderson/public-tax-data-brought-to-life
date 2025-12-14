import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { ensureDir, fileExists } from './files.js';

export interface DownloadResult {
  sha256: string;
  bytes: number;
}

export async function downloadToFile(url: string, destPath: string): Promise<DownloadResult> {
  await ensureDir(path.dirname(destPath));

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText} (${url})`);
  }

  const hash = createHash('sha256');
  let bytes = 0;

  const nodeStream = Readable.fromWeb(response.body as any);
  const fileStream = createWriteStream(destPath);

  await new Promise<void>((resolve, reject) => {
    nodeStream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    nodeStream.on('error', reject);
    fileStream.on('error', reject);
    fileStream.on('finish', resolve);
    nodeStream.pipe(fileStream);
  });

  return { sha256: hash.digest('hex'), bytes };
}

export async function ensureDownloaded(url: string, destPath: string): Promise<DownloadResult | null> {
  const exists = await fileExists(destPath);
  if (exists) return null;
  return downloadToFile(url, destPath);
}
