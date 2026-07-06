// Core domain types for the Dockerfile analyzer.
//
// The pipeline is: raw text -> Instruction[] (parser) -> Layer[] (layer model)
// -> Analysis (cache + size reasoning + suggestions). Every stage is pure and
// independently testable.

/** A single logical instruction parsed from a Dockerfile. */
export interface Instruction {
  /** Uppercased keyword, e.g. "FROM", "RUN", "COPY". */
  readonly keyword: string;
  /** The argument text with line continuations already joined. */
  readonly args: string;
  /** 1-based line number of the instruction's first physical line. */
  readonly line: number;
  /** Index of the build stage this instruction belongs to (0-based). */
  readonly stage: number;
}

/** Whether an instruction produces a filesystem layer or only image metadata. */
export type LayerKind = 'filesystem' | 'metadata';

/**
 * Relative size weight of a layer. We cannot know real byte sizes without
 * running the build, so we estimate a unitless weight from the instruction's
 * semantics (a package install weighs far more than an `ENV`). Bigger = heavier.
 */
export type SizeWeight = number;

/** A layer in the modeled image, mapped 1:1 from a build instruction. */
export interface Layer {
  readonly index: number;
  readonly instruction: Instruction;
  readonly kind: LayerKind;
  /** Estimated relative size weight; metadata layers are ~0. */
  readonly weight: SizeWeight;
  /** Human-readable note on why this layer weighs what it does. */
  readonly sizeNote: string;
}

/** The result of parsing a Dockerfile. */
export interface ParsedDockerfile {
  readonly instructions: Instruction[];
  /** Number of build stages (>= 1). */
  readonly stageCount: number;
  /** Non-fatal parse warnings (unknown keyword, empty continuation, etc.). */
  readonly warnings: ParseWarning[];
}

export interface ParseWarning {
  readonly line: number;
  readonly message: string;
}
