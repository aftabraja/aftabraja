import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export function useLeague() {
  const { leagueId } = useParams();
  const q = useQuery({ queryKey: ['league', leagueId], queryFn: () => get(`/leagues/${leagueId}`), enabled: !!leagueId });
  return { leagueId: leagueId!, league: q.data, ...q, isAdmin: q.data?.access === 'admin', isStaff: q.data?.access === 'admin' || q.data?.access === 'staff' };
}
