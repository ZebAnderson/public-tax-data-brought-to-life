import AdmZip from 'adm-zip';
import path from 'node:path';
import { ensureDir, dirIsNonEmpty, findFirstFileRecursive } from './files.js';
import { log } from './logger.js';

// Mike Bostock's shapefile package
import * as shapefile from 'shapefile';

export interface ShapefileSourcePaths {
  shpPath: string;
  dbfPath: string;
}

export async function ensureUnzipped(zipPath: string, destDir: string): Promise<void> {
  await ensureDir(destDir);
  if (await dirIsNonEmpty(destDir)) return;

  log.info(`Unzipping ${path.basename(zipPath)}...`, { destDir });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

export async function findShapefilePaths(destDir: string): Promise<ShapefileSourcePaths> {
  const shpPath = await findFirstFileRecursive(destDir, (p) => p.toLowerCase().endsWith('.shp'));
  const dbfPath = await findFirstFileRecursive(destDir, (p) => p.toLowerCase().endsWith('.dbf'));
  if (!shpPath || !dbfPath) {
    throw new Error(`Could not find .shp/.dbf in ${destDir}`);
  }
  return { shpPath, dbfPath };
}

export async function* iterShapefileFeatures(
  shpPath: string,
  dbfPath: string
): AsyncGenerator<any> {
  const source = await shapefile.open(shpPath, dbfPath);
  while (true) {
    const { done, value } = await source.read();
    if (done) break;
    yield value;
  }
}

