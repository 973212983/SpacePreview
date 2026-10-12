import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { databaseTables, databasePage, isSqliteDatabase, databaseError } from './database';

describe('read-only database preview', () => {
  it('requires the complete SQLite header instead of trusting the .db extension', async () => {
    const SQL = await initSqlJs();
    const database = new SQL.Database();
    try {
      database.run('CREATE TABLE records (id INTEGER)');
      const bytes = database.export();
      expect(isSqliteDatabase(bytes)).toBe(true);
      expect(isSqliteDatabase(bytes.slice(0, 15))).toBe(false);
      const wrongTerminator = bytes.slice(0, 16);
      wrongTerminator[15] = 1;
      expect(isSqliteDatabase(wrongTerminator)).toBe(false);
      expect(isSqliteDatabase(new Uint8Array([0x69, 0x70, 0x02, 0x62]))).toBe(false);
      expect(isSqliteDatabase(new TextEncoder().encode('{"cache":true}'))).toBe(false);
    } finally {
      database.close();
    }
  });

  it('explains unsupported or damaged databases without raw SQLite errors', () => {
    expect(databaseError(new Error('file is not a database'))).toContain('并非标准 SQLite');
    expect(databaseError(new Error('database disk image is malformed'))).toContain('已损坏');
    expect(databaseError(new Error('数据库表不存在。'))).toBe('数据库表不存在。');
  });

  it('reads quoted Unicode names, all record pages, views, NULL and BLOB values', async () => {
    const SQL = await initSqlJs();
    const database = new SQL.Database();
    try {
      database.run('CREATE TABLE "表""名" (id INTEGER, value TEXT, bytes BLOB)');
      database.run('CREATE VIEW "视图" AS SELECT * FROM "表""名"');
      for (let i = 0; i < 405; i++)
        database.run('INSERT INTO "表""名" VALUES (?, ?, ?)', [
          i,
          i === 0 ? null : `中文 ${i}`,
          new Uint8Array([1, 2, 3]),
        ]);
      database.run('PRAGMA query_only = ON');
      expect(databaseTables(database).map((table) => table.name)).toEqual(['表"名', '视图']);
      const first = databasePage(database, '表"名', 0);
      expect(first.count).toBe(405);
      expect(first.columns).toEqual(['id', 'value', 'bytes']);
      expect(first.rows[0]).toEqual(['0', 'NULL', 'BLOB (3 B) 01 02 03']);
      expect(databasePage(database, '表"名', 1).rows).toHaveLength(200);
      expect(databasePage(database, '视图', 2).rows.at(-1)?.[1]).toBe('中文 404');
      expect(() => databasePage(database, '表"名; DROP TABLE', 0)).toThrow('不存在');
      expect(() => databasePage(database, '表"名', -1)).toThrow('页码');
      expect(() => database.run('DELETE FROM "表""名"')).toThrow();
    } finally {
      database.close();
    }
  });
});
