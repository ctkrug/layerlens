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
  const collapsed = collectHeredocs(physical, warnings);
  const logical = joinContinuations(collapsed, escapeChar, warnings);

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

/** A heredoc redirect on an instruction line: `<<EOF`, `<<-EOF`, `<<"EOF"`. */
const HEREDOC = /<<(-?)(["']?)([A-Za-z_][A-Za-z0-9_]*)\2/g;

interface Heredoc {
  readonly word: string;
  readonly stripTabs: boolean;
}

/** Every heredoc delimiter declared on one instruction line, in order. */
function heredocDelims(text: string): Heredoc[] {
  const delims: Heredoc[] = [];
  HEREDOC.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEREDOC.exec(text)) !== null) {
    delims.push({ word: m[3], stripTabs: m[1] === '-' });
  }
  return delims;
}

/**
 * BuildKit heredocs (`RUN <<EOF … EOF`) span multiple physical lines whose body
 * is literal shell, not further Dockerfile instructions. Fold each heredoc's
 * body into its opening line so the rest of the parser sees one instruction —
 * otherwise the body lines parse as bogus instructions (spurious warnings) and
 * the install inside them escapes the weight model. Runs before continuation
 * joining. A line may open several heredocs; their bodies close in order.
 */
function collectHeredocs(lines: RawLine[], warnings: ParseWarning[]): RawLine[] {
  const out: RawLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const { text, line } = lines[i];
    // Comments and lines without a heredoc redirect pass through untouched.
    if (/^\s*#/.test(text)) {
      out.push(lines[i]);
      continue;
    }
    const delims = heredocDelims(text);
    if (delims.length === 0) {
      out.push(lines[i]);
      continue;
    }

    const body: string[] = [];
    let cursor = i + 1;
    let unterminated = false;
    for (const d of delims) {
      let closed = false;
      while (cursor < lines.length) {
        const raw = lines[cursor].text;
        cursor += 1;
        const candidate = d.stripTabs ? raw.replace(/^\t+/, '') : raw;
        if (candidate.trim() === d.word) {
          closed = true;
          break;
        }
        body.push(d.stripTabs ? raw.replace(/^\t+/, '') : raw);
      }
      if (!closed) {
        unterminated = true;
        break;
      }
    }
    if (unterminated) {
      warnings.push({ line, message: `unterminated heredoc (expected \`${delims[0].word}\`)` });
    }

    // Rebuild the instruction: drop the `<<DELIM` operators, append the body so
    // detectors (heavy install, etc.) still see the commands. Blank/`#` body
    // lines are literal here, so they must not be dropped later.
    const opener = text.replace(HEREDOC, '').replace(/\s+/g, ' ').trim();
    const folded = [opener, ...body.map((b) => b.trim()).filter((b) => b !== '')].join(' ').trim();
    out.push({ text: folded, line });
    i = cursor - 1;
  }
  return out;
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
