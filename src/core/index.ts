// Public API of the core analyzer. The UI and tests import from here.
export * from './types';
export { parseDockerfile, KNOWN_KEYWORDS } from './parser';
export { buildLayers, classify, estimateWeight, totalWeight, baseImageRef } from './layers';
export { analyzeSource, analyzeLayers, sourceEditSeeds, finalStageWeight } from './analyze';
export type { Analysis, LayerAnalysis, Suggestion, Severity } from './analyze';
export { computeCascade, stageNames, crossStageTarget } from './cascade';
