import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Rule = { name: string; pattern: RegExp };
const CONTENT_RULES: Rule[] = [
  { name: 'excluded-branding', pattern: new RegExp(['vi', 'bra'].join(''), 'i') },
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: 'github-token', pattern: /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/u },
  { name: 'provider-secret', pattern: /(?:sk-(?:proj-|live_)?[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{20,})/u },
  { name: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { name: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/u },
  { name: 'credential-url', pattern: /https?:\/\/[^\s/:]+:[^\s/]+@/u },
  { name: 'email-address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u },
  { name: 'local-machine-path', pattern: /\/(?:Users|home|private)\/[^\s"']+/u },
];

export function inspectPublicationText(text: string): string[] {
  return CONTENT_RULES.filter(rule => rule.pattern.test(text)).map(rule => rule.name);
}

export function checkPublication(): void {
  const files = execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8', timeout: 10_000 })
    .split('\0').filter(Boolean);
  if (!files.length) throw new Error('No staged/tracked files to inspect.');
  let failures = 0;
  for (const file of files) {
    if (CONTENT_RULES[0]!.pattern.test(file)) {
      console.error('Excluded branding in a tracked path.');
      failures++;
      continue;
    }
    if (/(^|\/)(?:node_modules|\.env[^/]*|\.npmrc|credentials\.json)(?:\/|$)|\.(?:p8|p12|pem|key)$/iu.test(file)) {
      console.error(`${file}: prohibited publication path`);
      failures++;
      continue;
    }
    const contents = execFileSync('git', ['show', `:${file}`], { timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
    if (contents.includes(0)) {
      console.error(`${file}: binary file requires separate review`);
      failures++;
      continue;
    }
    const findings = inspectPublicationText(contents.toString('utf8'));
    for (const finding of findings) console.error(`${file}: ${finding}`);
    failures += findings.length;
  }
  console.log(`Publication scan: ${files.length} files, ${failures} findings. Matched values are never printed.`);
  if (failures) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkPublication();
