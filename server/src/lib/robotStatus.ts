import { config } from '../config.js';

export type RobotStatus = 'connected' | 'disconnected' | 'sending_data' | 'error';

export function robotStatus(d: { lastSeenAt: Date | null; lastDataAt: Date | null; lastErrorAt: Date | null }, now = new Date()): RobotStatus {
  const onlineMs = config.robotOnlineMinutes * 60_000;
  const recent = (t: Date | null, ms: number) => !!t && now.getTime() - t.getTime() <= ms;
  if (d.lastErrorAt && recent(d.lastErrorAt, onlineMs) && (!d.lastDataAt || d.lastErrorAt > d.lastDataAt)) return 'error';
  if (recent(d.lastDataAt, 2 * 60_000)) return 'sending_data';
  if (recent(d.lastSeenAt, onlineMs)) return 'connected';
  return 'disconnected';
}
