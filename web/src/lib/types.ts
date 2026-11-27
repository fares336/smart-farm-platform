import type { LText } from './i18n';

export type Source = 'ROBOT' | 'MANUAL' | 'LAB';
export interface Reading { value: number; at: string; source: Source }
export type ZoneReadings = Partial<Record<'moisture' | 'ph' | 'ec' | 'temperature', Reading>> & { lastAt?: string };

export interface Zone {
  id: string; code: string; row: number; col: number; polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon; centroidLat: number; centroidLng: number; areaM2: number;
  cropKey: string | null; growthStage: string | null; readings: ZoneReadings; status: 'good' | 'attention' | 'critical' | 'no_data'; irrigationStatus: string;
  topCrop: { key: string; nameEn: string; nameAr: string; suitability: number } | null;
}

export interface Crop { id: string; key: string; nameEn: string; nameAr: string; phOptMin: number; phOptMax: number; tempOptMin: number; tempOptMax: number; moistureOptMin: number; moistureOptMax: number; ecThreshold: number; waterNeedMm: string; seasonEn: string | null; seasonAr: string | null; references: string }

export interface Issue { id: string; title: LText; priority: number; severity: 'critical' | 'warning' | 'info'; confidence: 'high' | 'medium' | 'low'; evidence: LText[]; actions: LText[]; explanation: LText }
export interface ZoneDecision { zoneId?: string; zoneCode: string; status: Zone['status']; issues: Issue[]; missingData: LText[] }

export interface CropScore {
  cropKey: string; nameEn: string; nameAr: string; suitability: number; dataCoverage: number;
  components: { factor: string; score: number | null; weight: number; detail: LText }[];
  soilCompatibility: number | null; climateCompatibility: number | null; waterRequirementsMm: string; limitations: LText[]; actions: LText[]; why: LText;
}

export interface IrrigationAdvice { status: string; moisture: number | null; targetMin: number | null; targetMax: number | null; kc: number | null; et0MmDay: number | null; etcMmDay: number | null; dailyNeedM3: number | null; reasons: LText[] }

export interface WeatherSummary {
  latest: { date: string; t2m: number | null; t2mMax: number | null; t2mMin: number | null; rh2m: number | null; precipMm: number | null; windMs: number | null; solarMjM2: number | null; et0Mm: number | null };
  latestDate: string; lastFetchedAt: string; mean30: { t2m: number | null; rh2m: number | null; precipTotal: number }; et0Mean7: number | null; rain3: number; maxTemp3: number;
}

export interface FinancialSummary { totalRevenue: number; totalCosts: number; netProfit: number; profitMarginPct: number | null; harvestTon: number; soldTon: number; unsoldTon: number; costPerTon: number | null; expensesByCategory: Record<string, number> }
