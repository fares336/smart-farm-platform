import { prisma } from '../db.js';
import { HttpError } from '../middleware/error.js';

export async function ownedFarm(userId: string, farmId: string) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw new HttpError(404, 'Farm not found');
  return farm;
}

export async function ownedZone(userId: string, zoneId: string) {
  const zone = await prisma.farmZone.findFirst({ where: { id: zoneId, farm: { userId } } });
  if (!zone) throw new HttpError(404, 'Zone not found');
  return zone;
}

export async function ownedSeason(userId: string, seasonId: string) {
  const season = await prisma.financialSeason.findFirst({ where: { id: seasonId, farm: { userId } } });
  if (!season) throw new HttpError(404, 'Season not found');
  return season;
}
