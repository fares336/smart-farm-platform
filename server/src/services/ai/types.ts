export interface DiseaseCandidate {
  name: string;
  confidence: number | null;
  symptoms?: string;
  causes?: string;
  treatment?: string;
  prevention?: string;
  advice?: string;
}

export interface NutrientFinding {
  nutrient: string;
  confidence: number | null;
  visibleSymptoms?: string;
  possibleCauses?: string;
  affectedCrops?: string;
  treatment?: string;
  fertilizers?: string;
  additionalTests?: string;
}

export interface ImageInput {
  buffer: Buffer;
  mimeType: string;
  cropKey?: string | null;
  growthStage?: string | null;
  context?: Record<string, unknown>;
}

export interface DiseaseResult {
  candidates: DiseaseCandidate[];
  isHealthy?: boolean;
  notes?: string;
}

export interface NutrientResult {
  findings: NutrientFinding[];
  differentials?: string[];
  notes?: string;
}

export interface AiProvider {
  name: string;
  diagnoseDisease?(input: ImageInput): Promise<DiseaseResult>;
  analyzeNutrients?(input: ImageInput): Promise<NutrientResult>;
}

export class AiUnavailableError extends Error {}
