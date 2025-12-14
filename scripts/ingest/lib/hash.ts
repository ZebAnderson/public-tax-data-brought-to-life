import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function sha256HexFromBuffer(buf: Buffer): Promise<string> {
  return createHash('sha256').update(buf).digest('hex');
}

export async function sha256HexFromString(text: string): Promise<string> {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function sha256HexFromFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

