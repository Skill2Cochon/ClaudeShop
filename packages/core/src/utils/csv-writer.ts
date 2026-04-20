/**
 * Tiny RFC-4180-ish CSV writer — zero deps, mirrors csv-parser.ts on
 * the output side. Quotes fields that contain the separator, a double
 * quote, a CR, or an LF, and escapes embedded quotes by doubling them.
 * Always emits CRLF line endings so the resulting file opens cleanly
 * in Excel on Windows without auto-detection weirdness.
 */
export interface CsvWriteOptions {
  /** Field separator. Defaults to ','. */
  separator?: string;
  /** Emit a header row built from the first row's keys. Defaults to true. */
  header?: boolean;
  /** Explicit column order (and whitelist). Otherwise: keys of first row. */
  columns?: readonly string[];
}

export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  opts: CsvWriteOptions = {},
): string {
  const separator = opts.separator ?? ',';
  const emitHeader = opts.header !== false;
  if (rows.length === 0) return '';

  const columns =
    opts.columns ?? (Object.keys(rows[0] ?? {}) as readonly string[]);

  const lines: string[] = [];
  if (emitHeader) {
    lines.push(columns.map((c) => escape(c, separator)).join(separator));
  }

  for (const row of rows) {
    lines.push(
      columns
        .map((col) => escape(stringify(row[col]), separator))
        .join(separator),
    );
  }

  return `${lines.join('\r\n')}\r\n`;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}

function escape(field: string, separator: string): string {
  if (
    field.includes(separator) ||
    field.includes('"') ||
    field.includes('\r') ||
    field.includes('\n')
  ) {
    return `"${field.replaceAll('"', '""')}"`;
  }
  return field;
}
