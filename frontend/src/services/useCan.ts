import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './auth';

export type PermissionMap = Record<string, Record<string, boolean>>;

let cachedMap: PermissionMap | null = null;
let cachedRole: string | null = null;
let inflight: Promise<PermissionMap> | null = null;

async function fetchMyPermissions(role: string): Promise<PermissionMap> {
  if (cachedMap && cachedRole === role) return cachedMap;
  if (inflight && cachedRole === role) return inflight;
  inflight = (async () => {
    const { data } = await api.get('/permissions/me');
    cachedMap = data.effective as PermissionMap;
    cachedRole = role;
    inflight = null;
    return cachedMap;
  })();
  return inflight;
}

export function invalidatePermissionCache() {
  cachedMap = null;
  cachedRole = null;
  inflight = null;
}

export function useCan(resource: string, action: string): boolean {
  const { user } = useAuth();
  const [map, setMap] = useState<PermissionMap | null>(cachedMap);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const m = await fetchMyPermissions(user.role);
      setMap(m);
    } catch (err) {
      console.warn('useCan: falha ao carregar permissoes', err);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) return false;
  if (user.isMaster || user.role === 'admin') return true;
  if (!map) return false;
  return map[resource]?.[action] === true;
}

export function useCanAny(resource: string, actions: string[]): boolean {
  const { user } = useAuth();
  const [map, setMap] = useState<PermissionMap | null>(cachedMap);

  useEffect(() => {
    if (!user) return;
    if (cachedMap) { setMap(cachedMap); return; }
    fetchMyPermissions(user.role).then(setMap).catch(() => {});
  }, [user]);

  if (!user) return false;
  if (user.isMaster || user.role === 'admin') return true;
  if (!map) return false;
  return actions.some((a) => map[resource]?.[a] === true);
}
