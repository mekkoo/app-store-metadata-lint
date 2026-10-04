# Rule sources and limitations

Official documentation checked on 2026-10-03. These checks do not query App Store
Connect or establish current backend behavior. No Apple text is copied into the
implementation; rules are expressed as checks with our own messages.

## Primary sources

1. [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)
   gives name bounds of 2–30 characters and a subtitle maximum of 30 characters.
2. [Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
   describes a required keyword field with a 100-byte budget and advises avoiding
   repetition of app/company names.
3. [Creating your product page](https://developer.apple.com/app-store/product-page/)
   describes a 100-character keyword budget, comma separation, and permits spaces
   inside phrases. It recommends avoiding duplicates, category names, the generic
   word app, and plurals when the singular is already present.

## Documentation discrepancy

The keyword byte and character descriptions differ between sources 2 and 3.
Default `bytes` follows source 2, and opt-in `characters` follows source 3.
All reports include both measurements and the selected policy. No claim is made
about what a particular locale, API endpoint, or server accepts or indexes.

Source 2 also describes keyword terms as longer than two characters. This CLI
does not enforce a per-term minimum because source 3 gives no matching minimum
and a universal rule could incorrectly reject short CJK terms. Verify such terms
in App Store Connect before submission.

## Counting

Visible-field characters are counted as Unicode code points (`[...text].length`),
not JavaScript UTF-16 code units and not grapheme clusters. An emoji with modifiers
or a combining accent can consist of several code points. This is an explicit
local counting policy, not a claim about Apple's Unicode counting implementation.
UTF-8 bytes use `Buffer.byteLength`. Measurements retain all raw whitespace and
normalization forms; comparison normalization never alters budget measurements.

## Advisory matching

- Comparisons use NFKC normalization, lowercase conversion, and straightened
  typographic apostrophes. This can collapse stylistic distinctions; findings
  remain advisory and source text is never rewritten.
- A keyword term is split at a comma (common alternate separators are accepted
  for linting but warned about). Repeated whole terms are reported.
- Cross-field checks use exact Unicode letter/mark/number tokens, preserving
  internal apostrophes and hyphens. Japanese and other CJK text is retained.
  No CJK segmentation, substring matching, transliteration, or morphology is used.
  A term embedded in an unbroken CJK phrase may not be detected.
- Subtitle/name and subtitle/keyword repetition are review hints, not assertions
  about the search algorithm or App Review rejection.
- Category comparisons use user-supplied localized labels, not an Apple category
  registry. Company-name comparison is optional and only uses supplied text.
- English plural hints require an `en` locale and actual singular/plural tokens.
  Regular `s`, `es`, and consonant-`y`/`ies` pairs are considered in either order.
  Irregular plurals and linguistic exceptions are not inferred. A pair does not
  establish identical search reach.
- The CLI cannot verify relevance, trademark authorization, celebrity rights,
  keyword volume, cross-localization indexing, or listing performance.

## Scope and provenance

The initial idea came from a private deterministic ASO audit script. This standalone
implementation removes product-specific configuration and private metadata, adds
validated JSON, explicit keyword-unit selection, Unicode matching, deterministic
multi-file reports, and regression tests. It has no imports or runtime references
to the original script, shared Skills, or app repositories.

This is a new OSS tool. Existing use of the original private script is not evidence
of public adoption of this package. Contributions can improve language handling,
metadata adapters, and documented rules while preserving the offline scope.
