import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintMetadata, parseMetadata, measure } from '../src/lint.ts';
import type { Metadata } from '../src/lint.ts';

const clean: Metadata = { name: 'Pantry Notes', keywords: 'recipe,cooking', locale: 'en-US' };
const rules = (meta: Metadata) => lintMetadata(meta).findings.map(finding => finding.rule);

test('valid metadata has no findings and is not mutated', () => {
  const meta = Object.freeze({ ...clean });
  assert.deepEqual(lintMetadata(meta).findings, []);
});
test('name and subtitle character boundaries', () => {
  assert(rules({ ...clean, name: 'A' }).includes('length'));
  assert(!rules({ ...clean, name: 'A'.repeat(30), subtitle: 'B'.repeat(30) }).includes('length'));
  assert.equal(rules({ ...clean, name: 'A'.repeat(31), subtitle: 'B'.repeat(31) }).filter(rule => rule === 'length').length, 2);
});
test('keywords are required, rather than silently passing an empty document', () => {
  assert.equal(lintMetadata(parseMetadata({})).findings.filter(finding => finding.rule === 'required').length, 2);
});
test('100-byte keyword boundary counts exact raw input', () => {
  assert(!rules({ ...clean, keywords: 'x'.repeat(100) }).includes('length'));
  assert(rules({ ...clean, keywords: 'x'.repeat(101) }).includes('length'));
  assert(rules({ ...clean, keywords: 'x'.repeat(99) + '  ' }).includes('length'));
});
test('CJK byte and character policies differ explicitly', () => {
  const meta = { ...clean, locale: 'ja-JP', keywords: '献'.repeat(34) };
  assert.deepEqual(measure(meta.keywords), { characters: 34, bytes: 102 });
  assert(lintMetadata(meta).findings.some(finding => finding.rule === 'length'));
  assert(!lintMetadata(meta, 'characters').findings.some(finding => finding.rule === 'length'));
});
test('emoji use code points rather than UTF-16 code units', () => {
  assert.deepEqual(measure('🍳'), { characters: 1, bytes: 4 });
  assert(!rules({ ...clean, name: '🍳'.repeat(30) }).includes('length'));
  assert(rules({ ...clean, name: '🍳'.repeat(31) }).includes('length'));
});
test('Japanese duplicates and fullwidth/case normalization', () => {
  const meta = { ...clean, name: '献立 ノート', keywords: '献立,レシピ,レシピ,ＮＯＴＥＳ,notes', locale: 'ja-JP' };
  const result = lintMetadata(meta).findings;
  assert(result.some(finding => finding.rule === 'duplicate-field' && finding.message.includes('献立')));
  assert.equal(result.filter(finding => finding.rule === 'duplicate-term').length, 2);
});
test('normalization handles composed and decomposed accents', () => {
  assert(rules({ ...clean, keywords: 'café,cafe\u0301' }).includes('duplicate-term'));
});
test('does not remove or match Japanese substrings', () => {
  assert(!rules({ ...clean, name: '牛肉丼', keywords: '牛肉', locale: 'ja-JP' }).includes('duplicate-field'));
});
test('duplicate terms match other fields, company, and category', () => {
  const result = lintMetadata({ ...clean, subtitle: 'Notes for dinner', companyName: 'Example', primaryCategory: 'Cooking', keywords: 'pantry,dinner,example,cooking' });
  assert.equal(result.findings.filter(finding => finding.rule === 'duplicate-field').length, 4);
  assert(result.findings.some(finding => finding.rule === 'duplicate-name'));
});
test('keyword phrases keep internal spaces and warn about separator spaces', () => {
  assert(!rules({ ...clean, keywords: 'real estate,house' }).includes('separator-space'));
  assert(rules({ ...clean, keywords: 'recipe, cooking' }).includes('separator-space'));
});
test('empty terms, alternate separators, and controls are advisory', () => {
  const result = lintMetadata({ ...clean, keywords: 'recipe、、\ncooking,' });
  for (const rule of ['empty-term', 'separator', 'control-whitespace']) assert(result.findings.some(finding => finding.rule === rule));
  assert(result.findings.every(finding => finding.severity === 'warning'));
});
test('regular English plural pairs are order-independent', () => {
  for (const keywords of ['recipe,recipes', 'recipes,recipe', 'city,cities', 'box,boxes']) {
    assert(rules({ ...clean, keywords }).includes('plural-pair'));
  }
  assert(!rules({ ...clean, keywords: 'bus,business' }).includes('plural-pair'));
});
test('English plural heuristics do not run on other or unspecified locales', () => {
  assert(!rules({ ...clean, locale: 'fr-FR', keywords: 'recipe,recipes' }).includes('plural-pair'));
  assert(!rules({ name: clean.name, keywords: 'recipe,recipes' }).includes('plural-pair'));
});
test('rejects bad JSON shapes, field types, locales, and unpaired surrogates', () => {
  for (const value of [null, [], 1, { name: 10 }, { keywords: null }, { locale: 'not_a_locale' }, { locale: '' }, { name: '\ud800' }]) {
    assert.throws(() => parseMetadata(value));
  }
});
test('unknown metadata fields are accepted but not echoed', () => {
  const parsed = parseMetadata({ ...clean, description: 'private description', unrelated: 42 });
  assert.deepEqual(parsed, clean);
  assert(!JSON.stringify(lintMetadata(parsed)).includes('private description'));
});
