export type KeywordLimit = 'bytes' | 'characters';
export type Metadata = {
  name: string;
  keywords: string;
  locale?: string;
  subtitle?: string;
  companyName?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
};
export type Finding = {
  severity: 'error' | 'warning';
  field: string;
  rule: string;
  message: string;
};
export type Measure = { characters: number; bytes: number };
export type LintResult = {
  locale: string | null;
  keywordLimit: KeywordLimit;
  counts: { name: Measure; subtitle: Measure; keywords: Measure };
  findings: Finding[];
};

const FIELDS = ['name', 'keywords', 'locale', 'subtitle', 'companyName',
  'primaryCategory', 'secondaryCategory'] as const;

/** Extra fields (e.g. description) are accepted but never inspected or echoed. */
export function parseMetadata(value: unknown): Metadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Metadata must be a JSON object.');
  }
  const object = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const field of FIELDS) {
    const entry = object[field];
    if (entry === undefined) continue;
    if (typeof entry !== 'string') throw new Error(`${field} must be a string.`);
    if (!entry.isWellFormed()) throw new Error(`${field} contains an unpaired Unicode surrogate.`);
    result[field] = entry;
  }
  if (result.locale !== undefined) {
    try { Intl.getCanonicalLocales(result.locale); }
    catch { throw new Error('locale must be a valid BCP 47 language tag.'); }
    if (!result.locale) throw new Error('locale must not be empty.');
  }
  return { ...result, name: result.name ?? '', keywords: result.keywords ?? '' };
}

export function measure(value: string): Measure {
  return { characters: [...value].length, bytes: Buffer.byteLength(value, 'utf8') };
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replaceAll('’', "'").trim();
}

/** Exact Unicode tokens; deliberately no CJK substring matching or stemming. */
function tokens(value: string): string[] {
  return normalize(value).match(/[\p{L}\p{M}\p{N}]+(?:['-][\p{L}\p{M}\p{N}]+)*/gu) ?? [];
}

function regularEnglishPlural(word: string): string | null {
  if (!/^[a-z]{3,}$/.test(word)) return null;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

export function lintMetadata(metadata: Metadata, keywordLimit: KeywordLimit = 'bytes'): LintResult {
  // Validate even callers of the library, not just the CLI.
  const meta = parseMetadata(metadata);
  const findings: Finding[] = [];
  const add = (severity: Finding['severity'], field: string, rule: string, message: string): void => {
    findings.push({ severity, field, rule, message });
  };
  const subtitle = meta.subtitle ?? '';
  const counts = { name: measure(meta.name), subtitle: measure(subtitle), keywords: measure(meta.keywords) };
  if (!meta.name.trim()) add('error', 'name', 'required', 'App name is required.');
  else if (counts.name.characters < 2 || counts.name.characters > 30) {
    add('error', 'name', 'length', `App name has ${counts.name.characters} characters; expected 2–30.`);
  }
  if (counts.subtitle.characters > 30) {
    add('error', 'subtitle', 'length', `Subtitle has ${counts.subtitle.characters} characters; maximum is 30.`);
  }
  if (!meta.keywords.trim()) add('error', 'keywords', 'required', 'Keywords are required.');
  const used = counts.keywords[keywordLimit];
  if (used > 100) add('error', 'keywords', 'length', `Keywords use ${used}/100 ${keywordLimit}.`);

  for (const field of ['name', 'subtitle', 'keywords'] as const) {
    const text = meta[field] ?? '';
    if (text !== text.trim()) add('warning', field, 'outer-whitespace', 'Remove leading or trailing whitespace; it consumes the measured budget.');
  }
  if (/[\r\n\t]/u.test(meta.keywords)) add('warning', 'keywords', 'control-whitespace', 'Keywords contain a line break or tab.');
  if (/[,，、;；]\s|\s[,，、;；]/u.test(meta.keywords)) {
    add('warning', 'keywords', 'separator-space', 'Remove whitespace around keyword separators; spaces inside phrases are allowed.');
  }
  if (/[，、;；]/u.test(meta.keywords)) add('warning', 'keywords', 'separator', 'Use ASCII commas to separate keyword terms.');
  const terms = meta.keywords.split(/[,，、;；]/u).map(normalize);
  if (meta.keywords.trim() && terms.some(term => !term)) add('warning', 'keywords', 'empty-term', 'Keyword list contains an empty term.');
  const seen = new Set<string>();
  const sources = [
    ['name', meta.name], ['subtitle', subtitle], ['companyName', meta.companyName ?? ''],
    ['category', `${meta.primaryCategory ?? ''} ${meta.secondaryCategory ?? ''}`],
  ] as const;
  const sourceTokens = sources.map(([field, text]) => ({ field, words: new Set(tokens(text)) }));
  const keywordWords = new Set(tokens(meta.keywords));
  for (const term of terms.filter(Boolean)) {
    if (seen.has(term)) add('warning', 'keywords', 'duplicate-term', `Keyword term "${term}" is repeated.`);
    seen.add(term);
  }
  for (const word of keywordWords) {
    for (const { field, words } of sourceTokens) {
      if (words.has(word)) add('warning', 'keywords', 'duplicate-field', `Keyword "${word}" also appears in ${field}.`);
    }
    if (word === 'app' || word === 'apps') add('warning', 'keywords', 'generic-app', `Consider removing the generic word "${word}".`);
  }
  const nameWords = sourceTokens[0]?.words ?? new Set<string>();
  for (const word of new Set(tokens(subtitle))) {
    if (nameWords.has(word)) add('warning', 'subtitle', 'duplicate-name', `Subtitle token "${word}" also appears in the name; review whether repetition is useful.`);
  }
  // Generate plurals from actual singulars, rather than stripping arbitrary suffixes.
  if (meta.locale?.toLowerCase().startsWith('en')) {
    const allWords = new Set([...keywordWords, ...sourceTokens.flatMap(source => [...source.words])]);
    for (const singular of allWords) {
      const plural = regularEnglishPlural(singular);
      if (plural && allWords.has(plural) && (keywordWords.has(singular) || keywordWords.has(plural))) {
        add('warning', 'keywords', 'plural-pair', `Both "${singular}" and "${plural}" are present; review the regular English plural pair.`);
      }
    }
  }
  return { locale: meta.locale ?? null, keywordLimit, counts, findings };
}
