import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

export const GRID = 16;
export const ZONE_COUNT = GRID * GRID;
const ROW_LETTERS = 'ABCDEFGHIJKLMNOP';
const BISECT_ITER = 40;

type Poly = Feature<Polygon | MultiPolygon>;

export interface ZoneGeometry {
  code: string;
  row: number;
  col: number;
  polygon: Polygon | MultiPolygon;
  centroidLat: number;
  centroidLng: number;
  areaM2: number;
}

export function zoneCode(row: number, col: number) {
  return `${ROW_LETTERS[row]}${col + 1}`;
}

/** Square boundary (lng/lat) centred on a point with the given area. */
export function squareBoundary(lat: number, lng: number, areaHectares: number): Polygon {
  const side = Math.sqrt(areaHectares * 10_000);
  const dLat = side / 2 / 111_320;
  const dLng = side / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ]],
  };
}

export function validateBoundary(poly: Polygon): string | null {
  const ring = poly.coordinates?.[0];
  if (!ring || ring.length < 4) return 'Boundary needs at least 3 distinct points';
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return 'Boundary ring must be closed';
  if (ring.some(([x, y]) => Math.abs(x) > 180 || Math.abs(y) > 90)) return 'Invalid coordinates';
  const kinks = turf.kinks(turf.polygon(poly.coordinates));
  if (kinks.features.length > 0) return 'Boundary edges must not cross each other';
  if (turf.area(poly) < 100) return 'Boundary area is too small';
  return null;
}

function clipArea(poly: Poly, box: [number, number, number, number]) {
  return turf.area(turf.bboxClip(poly, box));
}

/** Find cut positions along one axis so each slice holds an equal share of the area. */
function equalAreaCuts(poly: Poly, box: [number, number, number, number], axis: 'x' | 'y', parts: number) {
  const [minX, minY, maxX, maxY] = box;
  const lo = axis === 'x' ? minX : minY;
  const hi = axis === 'x' ? maxX : maxY;
  const total = turf.area(poly);
  const cuts = [lo];
  for (let i = 1; i < parts; i++) {
    const target = (total * i) / parts;
    let a = cuts[i - 1];
    let b = hi;
    for (let k = 0; k < BISECT_ITER; k++) {
      const mid = (a + b) / 2;
      const sub: [number, number, number, number] = axis === 'x' ? [minX, minY, mid, maxY] : [minX, minY, maxX, mid];
      if (clipArea(poly, sub) < target) a = mid;
      else b = mid;
    }
    cuts.push((a + b) / 2);
  }
  cuts.push(hi);
  return cuts;
}

/**
 * Divide a farm boundary into 256 zones of equal area that follow the real shape of the land:
 * 16 west→east strips of equal area, each split into 16 north→south cells of equal area.
 */
export function generateZones(boundary: Polygon): ZoneGeometry[] {
  const poly = turf.feature(boundary) as Poly;
  const box = turf.bbox(poly) as [number, number, number, number];
  const xCuts = equalAreaCuts(poly, box, 'x', GRID);
  const zones: ZoneGeometry[] = [];
  for (let c = 0; c < GRID; c++) {
    const stripBox: [number, number, number, number] = [xCuts[c], box[1], xCuts[c + 1], box[3]];
    const strip = turf.bboxClip(poly, stripBox) as Poly;
    const yCuts = equalAreaCuts(strip, stripBox, 'y', GRID);
    for (let j = 0; j < GRID; j++) {
      const row = GRID - 1 - j; // row A is the northern edge
      const cell = turf.bboxClip(strip, [xCuts[c], yCuts[j], xCuts[c + 1], yCuts[j + 1]]);
      const center = turf.pointOnFeature(cell).geometry.coordinates;
      zones.push({
        code: zoneCode(row, c),
        row,
        col: c,
        polygon: cell.geometry as Polygon | MultiPolygon,
        centroidLng: center[0],
        centroidLat: center[1],
        areaM2: turf.area(cell),
      });
    }
  }
  return zones.sort((a, b) => a.row - b.row || a.col - b.col);
}

export function findZoneForPoint<T extends { polygon: unknown }>(zones: T[], lat: number, lng: number): T | undefined {
  const pt = turf.point([lng, lat]);
  return zones.find((z) => turf.booleanPointInPolygon(pt, z.polygon as Polygon | MultiPolygon));
}

export function polygonAreaHectares(poly: Polygon) {
  return turf.area(poly) / 10_000;
}
