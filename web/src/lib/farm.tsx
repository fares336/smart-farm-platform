import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export interface Farm {
  id: string; name: string; areaHectares: number; latitude: number; longitude: number; locationName: string | null;
  waterSource: string | null; waterAvailability: string | null; defaultCropKey: string | null; soilTexture: string | null; isDemo: boolean; createdAt: string;
}

interface FarmCtx {
  farms: Farm[];
  farm: Farm | null;
  loading: boolean;
  select: (id: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<FarmCtx | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selected, setSelected] = useState<string | null>(() => localStorage.getItem('sf_farm'));
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setFarms((await api.get<{ farms: Farm[] }>('/farms')).farms);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => { reload(); }, [reload]);
  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem('sf_farm', id);
  };
  const farm = farms.find((f) => f.id === selected) ?? farms[0] ?? null;
  return <Ctx.Provider value={{ farms, farm, loading, select, reload }}>{children}</Ctx.Provider>;
}

export function useFarm() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFarm outside provider');
  return c;
}
