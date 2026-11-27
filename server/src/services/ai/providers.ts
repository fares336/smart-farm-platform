import { config } from '../../config.js';
import type { AiProvider, DiseaseResult, ImageInput, NutrientResult } from './types.js';

const clamp01 = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : null);

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

/** Kindwise crop.health (paid API, key required). https://crop.kindwise.com */
export const kindwiseProvider: AiProvider = {
  name: 'kindwise',
  async diagnoseDisease(input: ImageInput): Promise<DiseaseResult> {
    const key = config.ai.kindwiseApiKey;
    if (!key) throw new Error('KINDWISE_API_KEY not set');
    const json = await postJson(
      'https://crop.kindwise.com/api/v1/identification?details=common_names,description,symptoms,treatment,cause,severity',
      { 'Api-Key': key },
      { images: [`data:${input.mimeType};base64,${input.buffer.toString('base64')}`], similar_images: false },
    );
    const sugg: Array<Record<string, any>> = json?.result?.disease?.suggestions ?? [];
    const fmt = (v: unknown) => (v == null ? undefined : typeof v === 'string' ? v : Array.isArray(v) ? v.join('; ') : Object.entries(v as object).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join('; ') : x}`).join(' | '));
    return {
      candidates: sugg.slice(0, 3).map((s) => ({
        name: s.details?.common_names?.[0] ?? s.name,
        confidence: clamp01(s.probability),
        symptoms: fmt(s.details?.symptoms),
        causes: fmt(s.details?.cause),
        treatment: fmt(s.details?.treatment),
        prevention: fmt(s.details?.treatment?.prevention),
        advice: fmt(s.details?.description),
      })),
      isHealthy: json?.result?.is_healthy?.binary,
    };
  },
};

const DISEASE_PROMPT = (crop?: string | null) => `You are a plant pathologist. Examine this plant photo${crop ? ` (farmer says the crop is: ${crop})` : ''}.
Return ONLY JSON: {"is_healthy": boolean, "candidates":[{"name":string,"confidence":number 0-1,"symptoms":string,"causes":string,"treatment":string,"prevention":string,"advice":string}], "notes": string}
List up to 3 most likely diseases ordered by confidence. If the image is not a plant or too unclear, return an empty candidates list and explain in notes. Do not invent certainty.`;

const NUTRIENT_PROMPT = (input: ImageInput) => `You are an agronomist. Examine this plant photo for VISIBLE symptoms that may indicate nutrient deficiency (N, P, K, Ca, Mg, S, Fe, Zn, Mn, B, Cu).
Crop: ${input.cropKey ?? 'unknown'}; growth stage: ${input.growthStage ?? 'unknown'}; soil context: ${JSON.stringify(input.context ?? {})}.
Images cannot measure soil nutrient concentrations; report only possible symptoms. Consider salinity, drought, waterlogging and disease as look-alikes.
Return ONLY JSON: {"findings":[{"nutrient":"N|P|K|Ca|Mg|S|Fe|Zn|Mn|B|Cu","confidence":number 0-1,"visibleSymptoms":string,"possibleCauses":string,"affectedCrops":string,"treatment":string,"fertilizers":string,"additionalTests":string}],"differentials":[string],"notes":string}
Order findings by confidence, max 4. Never give fertilizer doses.`;

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Model did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

async function anthropicVision(input: ImageInput, prompt: string) {
  const key = config.ai.anthropicApiKey;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const json = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model: config.ai.anthropicModel,
      max_tokens: 1500,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: input.mimeType, data: input.buffer.toString('base64') } }, { type: 'text', text: prompt }] }],
    },
  );
  const text = (json?.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  return extractJson(text);
}

/** Anthropic Claude vision (paid API, key required). General-purpose model, not a calibrated classifier. */
export const anthropicProvider: AiProvider = {
  name: 'anthropic',
  async diagnoseDisease(input) {
    const j = await anthropicVision(input, DISEASE_PROMPT(input.cropKey));
    return { candidates: (j.candidates ?? []).slice(0, 3).map((c: any) => ({ ...c, confidence: clamp01(c.confidence) })), isHealthy: j.is_healthy, notes: j.notes };
  },
  async analyzeNutrients(input) {
    const j = await anthropicVision(input, NUTRIENT_PROMPT(input));
    return { findings: (j.findings ?? []).slice(0, 4).map((f: any) => ({ ...f, confidence: clamp01(f.confidence) })), differentials: j.differentials, notes: j.notes };
  },
};

/**
 * Self-hosted model server (e.g. a PlantVillage / DINOv2 classifier).
 * POST {CUSTOM_AI_URL}/disease or /nutrients with JSON {image_base64, mime_type, crop, growth_stage, context}
 * and return the same JSON shapes as DiseaseResult / NutrientResult.
 */
export const customProvider: AiProvider = {
  name: 'custom',
  async diagnoseDisease(input) {
    return callCustom<DiseaseResult>('disease', input);
  },
  async analyzeNutrients(input) {
    return callCustom<NutrientResult>('nutrients', input);
  },
};

async function callCustom<T>(path: string, input: ImageInput): Promise<T> {
  const base = config.ai.customModelUrl;
  if (!base) throw new Error('CUSTOM_AI_URL not set');
  const headers: Record<string, string> = config.ai.customModelToken ? { Authorization: `Bearer ${config.ai.customModelToken}` } : {};
  return postJson(`${base.replace(/\/$/, '')}/${path}`, headers, {
    image_base64: input.buffer.toString('base64'),
    mime_type: input.mimeType,
    crop: input.cropKey,
    growth_stage: input.growthStage,
    context: input.context ?? {},
  });
}

const REGISTRY: Record<string, AiProvider> = { kindwise: kindwiseProvider, anthropic: anthropicProvider, custom: customProvider };

function isConfigured(name: string) {
  if (name === 'kindwise') return !!config.ai.kindwiseApiKey;
  if (name === 'anthropic') return !!config.ai.anthropicApiKey;
  if (name === 'custom') return !!config.ai.customModelUrl;
  return false;
}

export function getProvider(kind: 'disease' | 'nutrient'): AiProvider | null {
  const name = kind === 'disease' ? config.ai.diseaseProvider : config.ai.nutrientProvider;
  const p = REGISTRY[name];
  if (!p || !isConfigured(name)) return null;
  if (kind === 'disease' && !p.diagnoseDisease) return null;
  if (kind === 'nutrient' && !p.analyzeNutrients) return null;
  return p;
}

export function aiStatus() {
  return {
    disease: { provider: config.ai.diseaseProvider, available: !!getProvider('disease') },
    nutrient: { provider: config.ai.nutrientProvider, available: !!getProvider('nutrient') },
  };
}
