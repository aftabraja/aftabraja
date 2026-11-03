import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, Globe, Handshake, MapPin, Search } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useLeague } from '../../lib/hooks';
import { inrShort } from '../../lib/format';
import { Avatar, Badge, Button, Card, Empty, Input, Modal, PageHeader, Spinner, Textarea } from '../../components/ui';

export default function FindSponsors() {
  const { leagueId, league } = useLeague();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [to, setTo] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const params = new URLSearchParams({ ...(q && { q }), ...(city && { city }) }).toString();
  const sponsors = useQuery({ queryKey: ['sponsors', params], queryFn: () => get<any[]>(`/sponsors?${params}`) });
  const send = useMutation({ mutationFn: () => post('/messages', { toUserId: to.user.id, leagueId, subject: `Sponsorship: ${league?.name}`, body: msg }), onSuccess: () => { setTo(null); setMsg(''); } });

  return (
    <>
      <PageHeader title="Find Sponsors" subtitle="Brands on SportsIQ actively looking for leagues to sponsor." />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><Input className="pl-9" placeholder="Company, industry…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </Card>
      {send.isSuccess && <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Message sent — continue the conversation in Messages.</div>}
      {sponsors.isLoading ? <Spinner /> : !sponsors.data?.length ? <Card><Empty icon={<Handshake className="h-5 w-5" />} title="No sponsors match" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sponsors.data.map((s) => (
            <div key={s.id} className="card flex flex-col p-5">
              <div className="flex gap-3">
                <Avatar name={s.companyName} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.companyName}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-500">
                    {s.industry && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{s.industry}</span>}
                    {s.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city}</span>}
                    {s.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{s.website}</span>}
                  </div>
                </div>
              </div>
              {s.description && <p className="mt-3 flex-1 text-sm text-ink-500">{s.description}</p>}
              {(s.budgetMin || s.budgetMax) && <Badge color="green" className="mt-3 self-start">Budget {inrShort(s.budgetMin)} – {inrShort(s.budgetMax)}</Badge>}
              <Button className="mt-4" variant="secondary" onClick={() => { setTo(s); setMsg(`Hi ${s.companyName} team, we're running ${league?.name}${league?.city ? ` in ${league.city}` : ''} and have sponsorship opportunities that fit your brand. Can we set up a call?`); }}>Message sponsor</Button>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!to} onClose={() => setTo(null)} title={`Message ${to?.companyName}`} footer={<><Button variant="secondary" onClick={() => setTo(null)}>Cancel</Button><Button loading={send.isPending} onClick={() => send.mutate()} disabled={!msg.trim()}>Send</Button></>}>
        <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </Modal>
    </>
  );
}
