// Hand-written Dockerfile parser.
//
// Turns raw Dockerfile text into a flat, ordered list of Instructions. It
// mirrors the daemon's front-end behavior closely enough to reason about
// layers and caching: line continuations are joined, comments and blank lines
// are dropped, and multi-stage `FROM ... AS` boundaries advance the stage
// counter. It intentionally does NOT execute or resolve variables — this is a
// static model, not a builder.

import type { Instruction, ParsedDockerfile, ParseWarning } from './types';

/** The set of instruction keywords Docker recognizes (BuildKit-era). */
export const KNOWN_KEYWORDS = new Set([
  'FROM',
  'RUN',
  'CMD',
  'LABEL',
  'MAINTAINER',
  'EXPOSE',
  'ENV',
  'ADD',
  'COPY',
  'ENTRYPOINT',
  'VOLUME',
  'USER',
  'WORKDIR',
  'ARG',
  'ONBUILD',
  'STOPSIGNAL',
  'HEALTHCHECK',
  'SHELL',
]);

/** Matches the escape parser directive, e.g. `# escape=\` or `# escape=\``. */
const ESCAPE_DIRECTIVE = /^#\s*escape\s*=\s*(\S)/i;

interface RawLine {
  readonly text: string;
  readonly line: number;
}

/**
 * Parse Dockerfile source into an ordered instruction list plus warnings.
 * The parser is total: malformed input yields warnings, never throws.
 */
export function parseDockerfile(source: string): ParsedDockerfile {
  const warnings: ParseWarning[] = [];
  const physical = source.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }));

  const escapeChar = detectEscapeChar(physical);
  const logical = joinContinuations(physical, escapeChar, warnings);

  const instructions: Instruction[] = [];
  let stage = -1;

  for (const { text, line } of logical) {
    const match = /^\s*(\S+)\s*([\s\S]*)$/.exec(text);
    if (!match) continue;

    const keyword = match[1].toUpperCase();
    const args = match[2].trim();

    if (keyword === 'FROM') {
      stage += 1;
    } else if (stage < 0) {
      // An instruction before any FROM is only legal for ARG (global scope).
      if (keyword === 'ARG') {
        stage = 0;
      } else {
        warnings.push({ line, message: `${keyword} appears before the first FROM` });
        stage = 0;
      }
    }

    if (!KNOWN_KEYWORDS.has(keyword)) {
      warnings.push({ line, message: `unknown instruction "${keyword}"` });
    }

    instructions.push({ keyword, args, line, stage: Math.max(stage, 0) });
  }

  const stageCount = instructions.filter((i) => i.keyword === 'FROM').length || (instructions.length ? 1 : 0);
  return { instructions, stageCount, warnings };
}

/** Read a leading `# escape=` parser directive; defaults to backslash. */
function detectEscapeChar(lines: RawLine[]): string {
  for (const { text } of lines) {
    const trimmed = text.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('#')) break; // directives must precede any builder line
    const m = ESCAPE_DIRECTIVE.exec(trimmed);
    if (m) return m[1] === '`' ? '`' : '\\';
    // A non-directive comment ends the directive-scanning window.
    if (!/^#\s*\w+\s*=/.test(trimmed)) break;
  }
  return '\\';
}

/**
 * Collapse physical lines into logical instructions, joining any line whose
 * trailing escape char continues onto the next. Comments and blank lines are
 * removed. Comment lines interleaved inside a continuation are ignored, matching
 * Docker's behavior.
 */
function joinContinuations(
  lines: RawLine[],
  escapeChar: string,
  warnings: ParseWarning[],
): RawLine[] {
  const out: RawLine[] = [];
  let buffer: string | null = null;
  let bufferLine = 0;

  for (const { text, line } of lines) {
    const isComment = /^\s*#/.test(text);

    if (buffer === null) {
      if (text.trim() === '' || isComment) continue;
      bufferLine = line;
      buffer = '';
    } else if (isComment) {
      // Comments inside a continuation are skipped, not appended.
      continue;
    }

    const continues = endsWithEscape(text, escapeChar);
    const chunk = continues ? text.slice(0, text.lastIndexOf(escapeChar)) : text;
    buffer += (buffer === '' ? '' : ' ') + chunk.trim();

    if (!continues) {
      if (buffer.trim() !== '') out.push({ text: buffer, line: bufferLine });
      buffer = null;
    }
  }

  if (buffer !== null && buffer.trim() !== '') {
    warnings.push({ line: bufferLine, message: 'line continuation at end of file' });
    out.push({ text: buffer, line: bufferLine });
  }

  return out;
}

/** True when a physical line ends with the escape char (ignoring trailing spaces). */
function endsWithEscape(text: string, escapeChar: string): boolean {
  const trimmedEnd = text.replace(/\s+$/, '');
  return trimmedEnd.endsWith(escapeChar);
}
