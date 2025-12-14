import path from 'node:path';

export function repoFileUrl(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return `taxatlas://repo/${normalized}`;
}

