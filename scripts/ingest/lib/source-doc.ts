import { readFile } from 'node:fs/promises';
import type { DbClient } from './db.js';
import { sha256HexFromBuffer, sha256HexFromFile, sha256HexFromString } from './hash.js';

export interface UpsertSourceDocInput {
  url: string;
  contentSha256: string;
  isDemo?: boolean;
  title?: string;
  mimeType?: string;
  publishedAt?: string; // YYYY-MM-DD
  retrievedAt?: string; // ISO
  notes?: string;
}

export async function upsertSourceDoc(
  client: DbClient,
  input: UpsertSourceDocInput
): Promise<string> {
  const result = await client.query<{ source_doc_id: string }>(
    `
    INSERT INTO source_doc (
      url,
      content_sha256,
      is_demo,
      title,
      mime_type,
      published_at,
      retrieved_at,
      notes
    )
    VALUES ($1, $2, COALESCE($3, false), $4, $5, $6::date, $7::timestamptz, $8)
    ON CONFLICT (url, content_sha256)
    DO UPDATE SET
      is_demo = EXCLUDED.is_demo,
      title = COALESCE(EXCLUDED.title, source_doc.title),
      mime_type = COALESCE(EXCLUDED.mime_type, source_doc.mime_type),
      published_at = COALESCE(EXCLUDED.published_at, source_doc.published_at),
      retrieved_at = COALESCE(EXCLUDED.retrieved_at, source_doc.retrieved_at),
      notes = COALESCE(EXCLUDED.notes, source_doc.notes)
    RETURNING source_doc_id
    `,
    [
      input.url,
      input.contentSha256,
      input.isDemo ?? false,
      input.title ?? null,
      input.mimeType ?? null,
      input.publishedAt ?? null,
      input.retrievedAt ?? null,
      input.notes ?? null,
    ]
  );

  return result.rows[0].source_doc_id;
}

export async function upsertSourceDocFromFile(
  client: DbClient,
  filePath: string,
  url: string,
  opts?: Omit<UpsertSourceDocInput, 'url' | 'contentSha256'>
): Promise<{ sourceDocId: string; contentSha256: string }> {
  const contentSha256 = await sha256HexFromFile(filePath);
  const sourceDocId = await upsertSourceDoc(client, {
    url,
    contentSha256,
    ...opts,
  });
  return { sourceDocId, contentSha256 };
}

export async function upsertSourceDocFromJson(
  client: DbClient,
  url: string,
  obj: unknown,
  opts?: Omit<UpsertSourceDocInput, 'url' | 'contentSha256'>
): Promise<{ sourceDocId: string; contentSha256: string }> {
  const text = JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort(), 2);
  const contentSha256 = await sha256HexFromString(text);
  const sourceDocId = await upsertSourceDoc(client, {
    url,
    contentSha256,
    ...opts,
  });
  return { sourceDocId, contentSha256 };
}

export async function upsertSourceDocFromText(
  client: DbClient,
  url: string,
  text: string,
  opts?: Omit<UpsertSourceDocInput, 'url' | 'contentSha256'>
): Promise<{ sourceDocId: string; contentSha256: string }> {
  const contentSha256 = await sha256HexFromString(text);
  const sourceDocId = await upsertSourceDoc(client, {
    url,
    contentSha256,
    ...opts,
  });
  return { sourceDocId, contentSha256 };
}

export async function upsertSourceDocFromBuffer(
  client: DbClient,
  url: string,
  buf: Buffer,
  opts?: Omit<UpsertSourceDocInput, 'url' | 'contentSha256'>
): Promise<{ sourceDocId: string; contentSha256: string }> {
  const contentSha256 = await sha256HexFromBuffer(buf);
  const sourceDocId = await upsertSourceDoc(client, {
    url,
    contentSha256,
    ...opts,
  });
  return { sourceDocId, contentSha256 };
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

