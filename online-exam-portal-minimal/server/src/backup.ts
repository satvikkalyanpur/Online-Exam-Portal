import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from './prisma.js';

/**
 * US20 / NFR8 - Backup and recovery of examination and result data.
 *
 * The backup is built from Prisma's runtime data model (Prisma.dmmf), so every
 * table in schema.prisma (exams, questions, exam-question links, results, ...)
 * is covered automatically. The User table is excluded by default so that a
 * restore can never overwrite login credentials; set BACKUP_EXCLUDE_MODELS
 * (comma separated, empty = exclude nothing) to change that.
 *
 * Consistency guarantees:
 *  - backup is read inside one RepeatableRead transaction (a single snapshot);
 *  - the file carries a SHA-256 checksum and a schema fingerprint;
 *  - restore validates everything BEFORE touching the database, then replaces
 *    the data inside ONE transaction and verifies row counts. Any failure rolls
 *    back, leaving the existing data untouched.
 */

export const BACKUP_FORMAT = 'online-exam-portal-backup';
export const BACKUP_VERSION = 1;
const INSERT_CHUNK_SIZE = 1000;

export class BackupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BackupError';
    this.status = status;
  }
}

type Row = Record<string, unknown>;

interface FieldMeta {
  name: string;
  kind: string;
  type: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  hasDefaultValue: boolean;
  relationFromFields?: readonly string[];
  relationToFields?: readonly string[];
}

interface ModelMeta {
  name: string;
  fields: readonly FieldMeta[];
  primaryKey?: { fields: readonly string[] } | null;
}

interface Delegate {
  findMany(args?: unknown): Promise<Row[]>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  createMany(args: { data: Row[] }): Promise<{ count: number }>;
  count(): Promise<number>;
}

export interface BackupFile {
  format: string;
  version: number;
  createdAt: string;
  createdBy: string | null;
  schema: string;
  models: string[];
  counts: Record<string, number>;
  checksum: string;
  tables: Record<string, Row[]>;
}

export interface RestoreResult {
  restoredAt: string;
  backupCreatedAt: string;
  counts: Record<string, { removed: number; restored: number }>;
}

let restoreRunning = false;

/* ------------------------------ data model ------------------------------ */

function allModels(): readonly ModelMeta[] {
  return Prisma.dmmf.datamodel.models as unknown as readonly ModelMeta[];
}

function excludedNames(): Set<string> {
  const raw = process.env.BACKUP_EXCLUDE_MODELS;
  const list = raw === undefined ? ['User'] : raw.split(',');
  return new Set(list.map((s) => s.trim()).filter(Boolean));
}

/** Models in scope, ordered so that parents come before the models that reference them. */
function scopedModels(): ModelMeta[] {
  const excluded = excludedNames();
  const models = allModels().filter((m) => !excluded.has(m.name));
  const names = new Set(models.map((m) => m.name));

  const deps = new Map<string, Set<string>>();
  for (const m of models) {
    const set = new Set<string>();
    for (const f of m.fields) {
      if (
        f.kind === 'object' &&
        (f.relationFromFields?.length ?? 0) > 0 &&
        names.has(f.type) &&
        f.type !== m.name
      ) {
        set.add(f.type);
      }
    }
    deps.set(m.name, set);
  }

  const sorted: ModelMeta[] = [];
  const done = new Set<string>();
  let remaining = [...models];
  while (remaining.length > 0) {
    const ready = remaining.filter((m) =>
      [...(deps.get(m.name) ?? [])].every((d) => done.has(d)),
    );
    if (ready.length === 0) {
      throw new BackupError(
        'Circular relations between models are not supported by backup and restore.',
        500,
      );
    }
    for (const m of ready) {
      sorted.push(m);
      done.add(m.name);
    }
    remaining = remaining.filter((m) => !done.has(m.name));
  }
  return sorted;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function schemaFingerprint(models: readonly ModelMeta[]): string {
  const description = models
    .map((m) => ({
      name: m.name,
      fields: m.fields
        .filter((f) => f.kind !== 'object')
        .map((f) => `${f.name}:${f.type}:${f.isList ? 'list' : 'one'}:${f.isRequired ? 'req' : 'opt'}`)
        .sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return sha256(JSON.stringify(description));
}

function delegateFor(client: unknown, model: ModelMeta): Delegate {
  const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
  const delegate = (client as Record<string, Delegate | undefined>)[key];
  if (!delegate) {
    throw new BackupError(`Model ${model.name} is not available on the database client.`, 500);
  }
  return delegate;
}

function primaryKeyFields(model: ModelMeta): string[] {
  if (model.primaryKey?.fields?.length) return [...model.primaryKey.fields];
  return model.fields.filter((f) => f.isId).map((f) => f.name);
}

/* ------------------------- value encode / decode ------------------------- */

function encodeValue(field: FieldMeta, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const one = (v: unknown): unknown => {
    switch (field.type) {
      case 'DateTime':
        return (v as Date).toISOString();
      case 'BigInt':
        return (v as bigint).toString();
      case 'Decimal':
        return String(v);
      case 'Bytes':
        return Buffer.from(v as Uint8Array).toString('base64');
      default:
        return v;
    }
  };
  return field.isList && Array.isArray(value) ? value.map(one) : one(value);
}

function encodeRow(model: ModelMeta, row: Row): Row {
  const out: Row = {};
  for (const f of model.fields) {
    if (f.kind === 'object') continue;
    out[f.name] = encodeValue(f, row[f.name]);
  }
  return out;
}

function decodeOne(model: ModelMeta, f: FieldMeta, v: unknown, index: number): unknown {
  const bad = (why: string) =>
    new BackupError(`Table ${model.name}, row ${index + 1}: field "${f.name}" ${why}.`);
  switch (f.type) {
    case 'String':
      if (typeof v !== 'string') throw bad('must be text');
      return v;
    case 'Int':
      if (typeof v !== 'number' || !Number.isInteger(v)) throw bad('must be an integer');
      return v;
    case 'Float':
      if (typeof v !== 'number') throw bad('must be a number');
      return v;
    case 'Boolean':
      if (typeof v !== 'boolean') throw bad('must be true or false');
      return v;
    case 'DateTime': {
      const d = typeof v === 'string' ? new Date(v) : null;
      if (!d || Number.isNaN(d.getTime())) throw bad('must be a valid date');
      return d;
    }
    case 'BigInt':
      try {
        if (typeof v !== 'string' && typeof v !== 'number') throw new Error();
        return BigInt(v);
      } catch {
        throw bad('must be a valid integer');
      }
    case 'Decimal':
      if (typeof v !== 'string' && typeof v !== 'number') throw bad('must be a decimal number');
      return String(v);
    case 'Bytes':
      if (typeof v !== 'string') throw bad('must be base64 text');
      return Buffer.from(v, 'base64');
    case 'Json':
      return v;
    default: // enum
      if (typeof v !== 'string') throw bad('must be text');
      return v;
  }
}

function decodeRow(model: ModelMeta, row: Row, index: number): Row {
  const out: Row = {};
  for (const f of model.fields) {
    if (f.kind === 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(row, f.name)) {
      if (f.isRequired && !f.hasDefaultValue) {
        throw new BackupError(`Table ${model.name}, row ${index + 1}: field "${f.name}" is missing.`);
      }
      continue;
    }
    const v = row[f.name];
    if (v === null || v === undefined) {
      if (f.isRequired && f.type !== 'Json') {
        throw new BackupError(
          `Table ${model.name}, row ${index + 1}: field "${f.name}" must not be empty.`,
        );
      }
      out[f.name] = f.type === 'Json' ? Prisma.JsonNull : null;
      continue;
    }
    if (f.isList) {
      if (!Array.isArray(v)) {
        throw new BackupError(`Table ${model.name}, row ${index + 1}: field "${f.name}" must be a list.`);
      }
      out[f.name] = v.map((x) => decodeOne(model, f, x, index));
    } else {
      out[f.name] = decodeOne(model, f, v, index);
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/* -------------------------------- status -------------------------------- */

export async function getBackupStatus() {
  const models = scopedModels();
  const counts = await Promise.all(
    models.map(async (m) => ({ name: m.name, rows: await delegateFor(prisma, m).count() })),
  );
  return { models: counts, excluded: [...excludedNames()] };
}

/* -------------------------------- backup -------------------------------- */

export async function createBackup(userId: string | null): Promise<BackupFile> {
  const models = scopedModels();

  const tables = await prisma.$transaction(
    async (tx) => {
      const out: Record<string, Row[]> = {};
      for (const m of models) {
        const pk = primaryKeyFields(m);
        const rows = await delegateFor(tx, m).findMany(
          pk.length ? { orderBy: pk.map((f) => ({ [f]: 'asc' })) } : undefined,
        );
        out[m.name] = rows.map((r) => encodeRow(m, r));
      }
      return out;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 10_000,
      timeout: 60_000,
    },
  );

  const counts: Record<string, number> = {};
  for (const m of models) counts[m.name] = tables[m.name]?.length ?? 0;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    schema: schemaFingerprint(models),
    models: models.map((m) => m.name),
    counts,
    checksum: sha256(JSON.stringify(tables)),
    tables,
  };
}

/* ------------------------------- validation ------------------------------ */

function validateBackup(input: unknown) {
  if (!isPlainObject(input) || input.format !== BACKUP_FORMAT) {
    throw new BackupError('This file is not an Online Exam Portal backup.');
  }
  if (input.version !== BACKUP_VERSION) {
    throw new BackupError(`Unsupported backup version: ${String(input.version)}.`);
  }
  if (typeof input.createdAt !== 'string' || typeof input.checksum !== 'string' || !isPlainObject(input.tables)) {
    throw new BackupError('The backup file is incomplete.');
  }

  if (sha256(JSON.stringify(input.tables)) !== input.checksum) {
    throw new BackupError('The backup file is corrupted or has been modified (checksum mismatch).');
  }

  const models = scopedModels();
  if (input.schema !== schemaFingerprint(models)) {
    throw new BackupError(
      'The backup was created with a different data schema or backup scope and cannot be restored here.',
    );
  }

  const tables = input.tables;
  const rawTables: Record<string, Row[]> = {};
  for (const m of models) {
    const t = tables[m.name];
    if (!Array.isArray(t) || !t.every(isPlainObject)) {
      throw new BackupError(`Table ${m.name} is missing or malformed in the backup.`);
    }
    rawTables[m.name] = t as Row[];
  }

  // Referential integrity inside the backup itself.
  const names = new Set(models.map((m) => m.name));
  const keyCache = new Map<string, Set<string>>();
  const keysOf = (model: string, fields: readonly string[]) => {
    const id = `${model}|${fields.join(',')}`;
    let set = keyCache.get(id);
    if (!set) {
      set = new Set((rawTables[model] ?? []).map((r) => JSON.stringify(fields.map((f) => r[f]))));
      keyCache.set(id, set);
    }
    return set;
  };
  for (const m of models) {
    for (const f of m.fields) {
      const from = f.relationFromFields ?? [];
      const to = f.relationToFields ?? [];
      if (f.kind !== 'object' || from.length === 0 || !names.has(f.type)) continue;
      const targets = keysOf(f.type, to);
      (rawTables[m.name] ?? []).forEach((row, i) => {
        const values = from.map((c) => row[c]);
        if (values.some((v) => v === null || v === undefined)) return;
        if (!targets.has(JSON.stringify(values))) {
          throw new BackupError(
            `Inconsistent backup: ${m.name} row ${i + 1} refers to a missing ${f.type} record.`,
          );
        }
      });
    }
  }

  const decoded: Record<string, Row[]> = {};
  const counts: Record<string, number> = {};
  for (const m of models) {
    decoded[m.name] = (rawTables[m.name] ?? []).map((row, i) => decodeRow(m, row, i));
    counts[m.name] = decoded[m.name]?.length ?? 0;
  }

  return { models, decoded, counts, createdAt: input.createdAt };
}

/* -------------------------------- restore -------------------------------- */

function toBackupError(error: unknown): BackupError {
  if (error instanceof BackupError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2003') {
      return new BackupError(
        'The backup refers to records that do not exist (for example a deleted user). Nothing was changed.',
        409,
      );
    }
    if (error.code === 'P2002') {
      return new BackupError('The backup contains duplicate records. Nothing was changed.', 409);
    }
    if (error.code === 'P2028') {
      return new BackupError('The restore timed out. Nothing was changed.', 500);
    }
  }
  console.error('Restore failed:', error);
  return new BackupError('Restore failed. Nothing was changed.', 500);
}

export async function restoreBackup(input: unknown, userId: string | null): Promise<RestoreResult> {
  if (restoreRunning) {
    throw new BackupError('Another restore is already in progress.', 409);
  }
  restoreRunning = true;
  try {
    const { models, decoded, counts, createdAt } = validateBackup(input);

    const removed = await prisma.$transaction(
      async (tx) => {
        const removedCounts: Record<string, number> = {};
        for (const m of [...models].reverse()) {
          removedCounts[m.name] = (await delegateFor(tx, m).deleteMany({})).count;
        }
        for (const m of models) {
          const rows = decoded[m.name] ?? [];
          for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
            await delegateFor(tx, m).createMany({ data: rows.slice(i, i + INSERT_CHUNK_SIZE) });
          }
        }
        for (const m of models) {
          const actual = await delegateFor(tx, m).count();
          if (actual !== counts[m.name]) {
            throw new BackupError(`Verification failed for ${m.name}; restore was rolled back.`, 500);
          }
        }
        return removedCounts;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    const result: RestoreResult = {
      restoredAt: new Date().toISOString(),
      backupCreatedAt: createdAt,
      counts: {},
    };
    for (const m of models) {
      result.counts[m.name] = { removed: removed[m.name] ?? 0, restored: counts[m.name] ?? 0 };
    }
    console.info(`[backup] restore completed by user ${userId ?? 'unknown'}`);
    return result;
  } catch (error) {
    throw toBackupError(error);
  } finally {
    restoreRunning = false;
  }
}