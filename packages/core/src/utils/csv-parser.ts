/**
 * Tiny RFC-4180-ish CSV parser — zero deps, streaming character state
 * machine. Handles quoted fields, escaped quotes ("") inside quoted fields,
 * and CRLF line endings. Not a full RFC 4180 impl (no BOM detection, no
 * tolerant recovery) but good enough for merchant imports up to ~50 MB.
 *
 * Returns an array of row objects keyed by the header row. Duplicate
 * header columns throw — the caller must normalise upstream.
 */
export interface CsvParseOptions {
  /** Field separator. Defaults to ','. Tab-separated sources use '\t'. */
  separator?: string;
  /** Trim whitespace around every field. Defaults to true. */
  trim?: boolean;
}

export function parseCsv(
  input: string,
  opts: CsvParseOptions = {},
): Array<Record<string, string>> {
  const sep = opts.separator ?? ',';
  const trim = opts.trim ?? true;
  const rows = tokenise(input, sep);
  if (rows.length === 0) return [];

  const rawHeader = rows[0]!;
  const header = rawHeader.map((h) => (trim ? h.trim() : h));
  ensureUniqueHeaders(header);

  const out: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.length === 1 && row[0]!.trim() === '') continue; // skip blank lines
    const entry: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c]!;
      const raw = row[c] ?? '';
      entry[key] = trim ? raw.trim() : raw;
    }
    out.push(entry);
  }
  return out;
}

function ensureUniqueHeaders(header: string[]): void {
  const seen = new Set<string>();
  for (const h of header) {
    if (seen.has(h)) {
      throw new Error(`Duplicate CSV header "${h}"`);
    }
    seen.add(h);
  }
}

/**
 * Tokenise the CSV into a string[][] of raw fields.
 *
 * State machine states:
 *   start    — beginning of a field, decide whether it's quoted
 *   unquoted — plain field, ends at separator / newline
 *   quoted   — inside quotes, ends at a closing quote not followed by "
 *   escape   — saw a quote while in quoted, may be "" (literal) or end-of-field
 */
function tokenise(input: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let state: 'start' | 'unquoted' | 'quoted' | 'escape' = 'start';

  const pushField = () => {
    row.push(field);
    field = '';
    state = 'start';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (state === 'start') {
      if (ch === '"') {
        state = 'quoted';
      } else if (ch === sep) {
        pushField();
      } else if (ch === '\n') {
        pushRow();
      } else if (ch === '\r') {
        // swallow, \n handles the row
      } else {
        field += ch;
        state = 'unquoted';
      }
      continue;
    }

    if (state === 'unquoted') {
      if (ch === sep) {
        pushField();
      } else if (ch === '\n') {
        pushRow();
      } else if (ch === '\r') {
        // swallow
      } else {
        field += ch;
      }
      continue;
    }

    if (state === 'quoted') {
      if (ch === '"') {
        state = 'escape';
      } else {
        field += ch;
      }
      continue;
    }

    if (state === 'escape') {
      if (ch === '"') {
        field += '"';
        state = 'quoted';
      } else if (ch === sep) {
        pushField();
      } else if (ch === '\n') {
        pushRow();
      } else if (ch === '\r') {
        // swallow; on \n we'll close the row
      } else {
        // Malformed — treat the stray char as plain text in the field.
        field += ch;
        state = 'unquoted';
      }
      continue;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
}
