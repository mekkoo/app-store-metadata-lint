import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../src/cli.ts';
import type { Report } from '../src/cli.ts';

const clean = { name: 'Pantry Notes', keywords: 'recipe,cooking', locale: 'en-US' };
function capture(args: string[]): { code: number; output: string } {
  let output = '';
  const code = run(args, text => { output += text; });
  return { code, output };
}
function fixture(work: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'metadata-lint-'));
  try { work(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('entry point runs in a separate Node process', () => {
  const result = spawnSync(process.execPath, ['src/cli.ts', 'examples/valid', '--strict', '--json'], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((JSON.parse(result.stdout) as Report).files.length, 2);
});
test('recurses, sorts, deduplicates, skips unrelated JSON and symlinks', () => fixture(directory => {
  mkdirSync(join(directory, 'ja-JP'));
  mkdirSync(join(directory, '.hidden'));
  mkdirSync(join(directory, 'node_modules'));
  const first = join(directory, 'a.metadata.json');
  writeFileSync(first, JSON.stringify(clean));
  writeFileSync(join(directory, 'ja-JP', 'metadata.json'), JSON.stringify(clean));
  writeFileSync(join(directory, 'package.json'), 'not json');
  writeFileSync(join(directory, '.hidden', 'metadata.json'), 'not json');
  writeFileSync(join(directory, 'node_modules', 'metadata.json'), 'not json');
  symlinkSync(directory, join(directory, 'loop'));
  const result = capture([directory, first, '--json']);
  assert.equal(result.code, 0);
  const report = JSON.parse(result.output) as Report;
  assert.equal(report.files.length, 2);
  assert.equal(report.files[0]?.file, first);
}));
test('advisories pass by default and fail with strict mode', () => fixture(directory => {
  const file = join(directory, 'metadata.json');
  writeFileSync(file, JSON.stringify({ ...clean, keywords: 'recipe,recipe' }));
  assert.equal(capture([file]).code, 0);
  assert.equal(capture([file, '--strict']).code, 1);
}));
test('hard findings exit 1 in either mode', () => {
  assert.equal(capture(['examples/invalid', '--json']).code, 1);
  assert.equal(capture(['examples/invalid', '--strict']).code, 1);
});
test('machine-readable failures exit 2 and preserve valid file results', () => fixture(directory => {
  writeFileSync(join(directory, 'good.metadata.json'), JSON.stringify(clean));
  writeFileSync(join(directory, 'bad.metadata.json'), '{"private": secret-content');
  const result = capture([directory, '--json']);
  assert.equal(result.code, 2);
  const report = JSON.parse(result.output) as Report;
  assert.equal(report.files.length, 1);
  assert.equal(report.usageErrors.length, 1);
  assert(!result.output.includes('secret-content'));
}));
test('invalid flags, missing files, invalid schemas, and empty directories exit 2', () => fixture(directory => {
  const file = join(directory, 'wrong.json');
  writeFileSync(file, '{"name":1}');
  for (const args of [[], ['--unknown'], ['--keyword-limit'], ['--keyword-limit', 'words'], ['no-such-file.json'], [directory], [file]]) {
    const result = capture([...args, '--json']);
    assert.equal(result.code, 2);
    assert((JSON.parse(result.output) as Report).usageErrors.length > 0);
  }
}));
test('unit flag changes the CJK limit without modifying the file', () => fixture(directory => {
  const file = join(directory, 'metadata.json');
  const source = JSON.stringify({ ...clean, keywords: '献'.repeat(34), locale: 'ja-JP' });
  writeFileSync(file, source);
  assert.equal(capture([file]).code, 1);
  assert.equal(capture([file, '--keyword-limit', 'characters']).code, 0);
  assert.equal(readFileSync(file, 'utf8'), source);
}));
test('files larger than 1 MiB and explicit symlinks are rejected', () => fixture(directory => {
  const file = join(directory, 'metadata.json');
  writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
  assert.equal(capture([file]).code, 2);
  const link = join(directory, 'link.json');
  symlinkSync(file, link);
  assert.equal(capture([link]).code, 2);
}));
test('help works and double dash treats flags as filenames', () => {
  assert.equal(capture(['--help']).code, 0);
  const result = capture(['--', '--json']);
  assert.equal(result.code, 2);
  assert(result.output.startsWith('INPUT ERROR:'));
});
