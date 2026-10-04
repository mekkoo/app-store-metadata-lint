import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintMetadata, parseMetadata } from './lint.ts';
import type { KeywordLimit, LintResult } from './lint.ts';

type FileReport = LintResult & { file: string };
export type Report = {
  schemaVersion: 1;
  files: FileReport[];
  errors: number;
  warnings: number;
  usageErrors: string[];
};
const HELP = `App Store Metadata Lint

Usage: node src/cli.ts <file.json|directory> [more paths...] [options]

Directory input recursively reads metadata.json and *.metadata.json only.
Hidden directories, node_modules, and symbolic links are skipped.

Options:
  --json                        Print a versioned JSON report
  --strict                      Fail on warnings as well as errors
  --keyword-limit bytes|characters  Keyword budget unit (default: bytes)
  --help, -h                    Show this help
  --                            Treat remaining arguments as paths

Exit codes: 0 clean (or warnings without --strict), 1 findings, 2 input/usage failure.
`;

function collectFiles(target: string, files: Set<string>, depth = 0, direct = true): void {
  if (depth > 20) throw new Error(`Directory nesting exceeds 20 levels: ${target}`);
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) {
    if (direct) throw new Error(`Symbolic link input is unsupported: ${target}`);
    return;
  }
  if (stat.isFile()) {
    if (direct || /(^metadata|\.metadata)\.json$/i.test(basename(target))) {
      if (stat.size > 1024 * 1024) throw new Error(`Metadata exceeds 1 MiB: ${target}`);
      files.add(target);
    }
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Input is not a regular file or directory: ${target}`);
  for (const name of readdirSync(target).sort()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    collectFiles(join(target, name), files, depth + 1, false);
  }
}

export function run(args: string[], write: (text: string) => void): number {
  const separator = args.indexOf('--');
  const json = args.slice(0, separator < 0 ? args.length : separator).includes('--json');
  const report: Report = { schemaVersion: 1, files: [], errors: 0, warnings: 0, usageErrors: [] };
  let strict = false;
  let unit: KeywordLimit = 'bytes';
  const paths: string[] = [];
  let positional = false;
  try {
    for (let index = 0; index < args.length; index++) {
      const arg = args[index]!;
      if (positional) paths.push(arg);
      else if (arg === '--') positional = true;
      else if (arg === '--help' || arg === '-h') { write(HELP); return 0; }
      else if (arg === '--json') { /* Output selected above. */ }
      else if (arg === '--strict') strict = true;
      else if (arg === '--keyword-limit') {
        const value = args[++index];
        if (value !== 'bytes' && value !== 'characters') throw new Error('--keyword-limit requires bytes or characters.');
        unit = value;
      } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
      else paths.push(arg);
    }
    if (!paths.length) throw new Error('Provide at least one JSON file or metadata directory. Use --help for usage.');
    const files = new Set<string>();
    for (const path of paths) {
      try {
        const selected = new Set<string>();
        collectFiles(resolve(path), selected);
        if (!selected.size) throw new Error(`No metadata.json or *.metadata.json found in: ${path}`);
        for (const file of selected) files.add(file);
      } catch (error) { report.usageErrors.push(errorMessage(error)); }
    }
    for (const file of [...files].sort()) {
      try {
        // Do not echo malformed JSON contents, which could contain private data.
        let value: unknown;
        try { value = JSON.parse(readFileSync(file, 'utf8')); }
        catch { throw new Error('Cannot read or parse JSON.'); }
        report.files.push({ file, ...lintMetadata(parseMetadata(value), unit) });
      } catch (error) { report.usageErrors.push(`${file}: ${errorMessage(error)}`); }
    }
  } catch (error) { report.usageErrors.push(errorMessage(error)); }
  for (const file of report.files) {
    report.errors += file.findings.filter(finding => finding.severity === 'error').length;
    report.warnings += file.findings.filter(finding => finding.severity === 'warning').length;
  }
  if (json) write(`${JSON.stringify(report, null, 2)}\n`);
  else {
    for (const file of report.files) {
      const status = file.findings.some(finding => finding.severity === 'error') ? 'FAIL'
        : file.findings.length ? 'WARN' : 'OK';
      write(`${status} ${file.file}\n`);
      write(`  name ${file.counts.name.characters}/30 chars; subtitle ${file.counts.subtitle.characters}/30 chars; keywords ${file.counts.keywords.bytes} bytes / ${file.counts.keywords.characters} chars (limit: 100 ${file.keywordLimit})\n`);
      for (const finding of file.findings) write(`  [${finding.severity}] ${finding.field}/${finding.rule}: ${finding.message}\n`);
    }
    for (const error of report.usageErrors) write(`INPUT ERROR: ${error}\n`);
    write(`${report.files.length} file(s): ${report.errors} error(s), ${report.warnings} warning(s), ${report.usageErrors.length} input error(s)\n`);
  }
  return report.usageErrors.length ? 2 : report.errors || (strict && report.warnings) ? 1 : 0;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2), text => process.stdout.write(text));
}
