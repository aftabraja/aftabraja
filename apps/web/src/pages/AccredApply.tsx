import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Upload } from 'lucide-react';
import { get, post } from '../lib/api';
import { fileToDataUrl } from '../lib/format';
import { Avatar, Button, Card, Empty, ErrorText, Field, Input, Select, Spinner } from '../components/ui';
import { Logo } from '../components/Logo';

/** Public accreditation application (media, broadcast, vendors, volunteers) */
export default function AccredApply() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['accred-apply', slug], queryFn: () => get(`/public/accreditation/${slug}`), retry: false });
  const [f, setF] = useState({ categoryId: '', name: '', organisation: '', designation: '', email: '', phone: '', photoUrl: '', idType: '', idNumber: '', consent: false });
  const submit = useMutation({ mutationFn: () => post(`/public/accreditation/${slug}`, f) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  if (q.isLoading) return <Spinner className="h-screen" />;
  return (
    <div className="min-h-screen bg-ink-50/50">
      <header className="border-b border-ink-200 bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">{q.data && <span className="flex items-center gap-3 font-bold"><Avatar name={q.data.league.name} src={q.data.league.logoUrl} size={34} />{q.data.league.name}</span>}<Logo size={22} /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {q.error ? <Card><Empty title={(q.error as Error).message} /></Card> : submit.isSuccess ? (
          <Card><div className="py-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /><p className="mt-4 text-xl font-bold">Application received</p><p className="mt-1 text-ink-500">Reference {submit.data.reference}. Bring your original photo ID when collecting your card. You'll be contacted once it is approved.</p></div></Card>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Accreditation application</h1>
            <p className="mt-1 text-sm text-ink-500">For media, broadcast, vendor and volunteer access. Every application is reviewed by the league.</p>
            <Card className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><ErrorText error={submit.error} /></div>
                <Field label="Applying as" className="sm:col-span-2"><Select value={f.categoryId} onChange={set('categoryId')} placeholder="Select category" options={q.data.categories.map((c: any) => ({ value: c.id, label: c.name }))} /></Field>
                <div className="flex items-center gap-4 sm:col-span-2">
                  <Avatar name={f.name || '?'} src={f.photoUrl} size={80} />
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-semibold hover:bg-ink-50"><Upload className="h-4 w-4" />Passport-style photo<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) { if (x.size > 3e6) return alert('Please use a photo under 3 MB'); setF({ ...f, photoUrl: await fileToDataUrl(x) }); } }} /></label>
                </div>
                <Field label="Full name (as on ID)"><Input value={f.name} onChange={set('name')} /></Field>
                <Field label="Organisation"><Input value={f.organisation} onChange={set('organisation')} /></Field>
                <Field label="Designation"><Input value={f.designation} onChange={set('designation')} placeholder="Reporter, Camera operator…" /></Field>
                <Field label="Email"><Input type="email" value={f.email} onChange={set('email')} /></Field>
                <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
                <Field label="Government photo ID"><Select value={f.idType} onChange={set('idType')} placeholder="Select" options={['Aadhaar', 'Passport', 'Driving licence', 'Voter ID', 'PAN', 'Press card']} /></Field>
                <Field label="ID number" hint="Only the last 4 digits are stored" className="sm:col-span-2"><Input value={f.idNumber} onChange={set('idNumber')} /></Field>
              </div>
            </Card>
            <Card className="mt-6" title="Terms & regulations">
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-ink-700">{q.data.policy}</pre>
              <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />I confirm the details are correct, I accept the accreditation terms, and I consent to my data being used for accreditation and venue security.</label>
              <Button size="lg" className="mt-4 w-full" loading={submit.isPending} disabled={!f.consent || !f.categoryId || !f.photoUrl} onClick={() => submit.mutate()}>Submit application</Button>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
