import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicationText } from '../scripts/check-publication.ts';

test('publication scan detects synthetic credentials without returning their values', () => {
  const fake = 'ghp_' + 'A'.repeat(36);
  assert.deepEqual(inspectPublicationText(fake), ['github-token']);
  assert(!JSON.stringify(inspectPublicationText(fake)).includes(fake));
  assert(inspectPublicationText('sk-' + 'x'.repeat(32)).includes('provider-secret'));
});
test('publication scan detects private key markers, contact addresses, and machine paths', () => {
  assert(inspectPublicationText(['-----BEGIN', 'PRIVATE KEY-----'].join(' ')).includes('private-key'));
  assert(inspectPublicationText(['person', 'example.invalid'].join('@')).includes('email-address'));
  assert(inspectPublicationText(['', 'Users', 'someone', 'data'].join('/')).includes('local-machine-path'));
});
test('publication scan allows normal metadata, public URLs, scoped packages, and integrity hashes', () => {
  assert.deepEqual(inspectPublicationText('献立,レシピ https://github.com/mekkoo/app-store-metadata-lint @types/node sha512-abc='), []);
});
test('publication scan rejects excluded branding regardless of case', () => {
  assert(inspectPublicationText(['Vi', 'BrA'].join('')).includes('excluded-branding'));
});
