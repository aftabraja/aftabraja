import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { LEGAL } from '../lib/legal';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-ink-200"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4"><Link to="/"><Logo size={28} /></Link><nav className="flex gap-4 text-sm"><Link to="/privacy" className="hover:text-brand-700">Privacy</Link><Link to="/terms" className="hover:text-brand-700">Terms</Link></nav></div></header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink-500">Last updated: {LEGAL.updated}</p>
        <div className="prose-legal mt-8 space-y-6 text-[15px] leading-relaxed text-ink-700">{children}</div>
      </main>
    </div>
  );
}
const H = ({ children }: { children: ReactNode }) => <h2 className="pt-2 text-lg font-bold text-ink-900">{children}</h2>;
const L = ({ items }: { items: ReactNode[] }) => <ul className="list-disc space-y-1 pl-6">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

export function Privacy() {
  return (
    <Shell title="Privacy Policy">
      <p>{LEGAL.entity} ("{LEGAL.brand}", "we") operates the {LEGAL.brand} platform for sports leagues. This policy explains what personal data we process, why, and your rights under India's Digital Personal Data Protection Act, 2023 ("DPDP Act") and other applicable law.</p>
      <H>1. Who is responsible</H>
      <p>For your account data, {LEGAL.brand} is the Data Fiduciary. Leagues using {LEGAL.brand} decide how they use data about their players, staff, accredited persons and ticket holders; for that data the league is responsible, and {LEGAL.brand} processes it on the league's instructions.</p>
      <H>2. Data we collect</H>
      <L items={[
        <><b>Account data:</b> name, email, phone, role, password (stored only as a one-way hash).</>,
        <><b>Profiles:</b> player details (playing role, stats, city, date of birth if provided), vendor, sponsor and agency business details.</>,
        <><b>Accreditation:</b> photograph, organisation, designation, ID type and only the <b>last 4 digits</b> of an ID number. We never store full ID numbers or ID scans.</>,
        <><b>League operations:</b> teams, squads, scores, travel and rooming details, finance entries and documents uploaded by league staff.</>,
        <><b>Payments:</b> handled by our payment gateway (Razorpay). We receive payment status and reference IDs, not your card or bank details.</>,
        <><b>Technical data:</b> IP address and security logs to protect accounts (for example, failed login attempts).</>,
      ]} />
      <H>3. Why we use it (purpose)</H>
      <L items={['To provide the platform: accounts, league management, auctions, scoring, ticketing, accreditation and messaging.', 'To send service emails such as invitations, password resets, receipts and alerts.', 'To keep the platform secure and prevent fraud and misuse.', 'To meet legal, tax and accounting obligations (for example GST invoices).']} />
      <p>We process data on the basis of your consent given at sign-up, or for legitimate uses permitted under the DPDP Act. We do not sell personal data and do not use it for third-party advertising.</p>
      <H>4. Children</H>
      <p>Players under 18 may only be registered with verifiable consent of a parent or guardian. Leagues must obtain that consent before adding a minor's data. We do not track or target advertising at children.</p>
      <H>5. Sharing</H>
      <L items={['With the league you register with or work for, to the extent needed to run that league.', 'With service providers that help us operate (hosting, email delivery, file storage, payment processing), under contract and only for these purposes.', 'Public information you or your league choose to publish (fixtures, scores, public profiles).', 'When required by law or to protect rights, safety and security.']} />
      <H>6. Retention</H>
      <p>We keep account data while your account is active. Accreditation data is deleted after the league season ends unless the law requires us to keep it. Financial records are kept for the period required by tax law. Security logs are kept for a limited period.</p>
      <H>7. Your rights</H>
      <L items={['Access a summary of your data — use "Download my data" in Account settings.', 'Correct or update your data from your profile.', 'Request erasure — use "Request account deletion" in Account settings. Some records (e.g. invoices) may be retained where the law requires.', 'Withdraw consent at any time (this may stop you from using some features).', 'Nominate another person to exercise your rights in case of death or incapacity.', `Raise a grievance with our Grievance Officer: ${LEGAL.grievanceOfficer}, ${LEGAL.grievanceEmail}. If unresolved, you may approach the Data Protection Board of India.`]} />
      <H>8. Security</H>
      <p>We use encryption in transit (HTTPS), hashed passwords, access controls by role, rate limiting and audit logs. No system is perfectly secure; we will notify affected users and authorities of a personal data breach as required by law.</p>
      <H>9. Cookies & local storage</H>
      <p>We use your browser's local storage to keep you signed in. We do not use advertising cookies.</p>
      <H>10. Contact</H>
      <p>{LEGAL.entity}, {LEGAL.address}. Email: {LEGAL.email}.</p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of Service">
      <p>These terms govern your use of {LEGAL.brand}, operated by {LEGAL.entity}. By creating an account you agree to them.</p>
      <H>1. The service</H>
      <p>{LEGAL.brand} is a software platform that helps sports leagues plan and run their operations, and connects leagues with vendors, sponsors, players and agencies. {LEGAL.brand} is a technology provider. We are <b>not</b> a party to any agreement between users (for example between a league and a vendor, sponsor, player, agency or ticket buyer) and do not guarantee the performance of any user.</p>
      <H>2. Accounts</H>
      <L items={['You must provide accurate information and keep your password secure.', 'You are responsible for activity under your account and for the people you invite to your league.', 'You must be 18 or older, or use the service with a parent or guardian\'s consent.']} />
      <H>3. Subscriptions & payments</H>
      <L items={['Paid plans are billed as shown on our pricing page, plus applicable GST. A tax invoice is issued for every payment.', 'Free trials convert to a paid plan only when you choose to pay.', 'Fees are non-refundable except where required by law or stated otherwise in writing.', 'Ticket payments are made to the league selling the tickets through our payment gateway.']} />
      <H>4. Your content and data</H>
      <p>You keep ownership of the content you upload. You grant us a licence to host and display it only to provide the service. You confirm you have the rights and consents needed for the content and personal data you upload — including photos, player details and accreditation data.</p>
      <H>5. Templates are not legal advice</H>
      <p>Contract templates, accreditation terms and sample documents are generic starting points. They are not legal advice. Always have agreements reviewed by a qualified lawyer before use.</p>
      <H>6. Agencies, managers and talent listings</H>
      <p>Agencies and managers may list only players they are authorised in writing to represent, and must remove a listing as soon as that authorisation ends. Fees shown are indicative. Agreements for endorsements, appearances or league signings are made directly between the parties.</p>
      <H>7. Acceptable use</H>
      <L items={['No unlawful, misleading or infringing content, impersonation or fake listings.', 'No betting, match-fixing or anything that compromises the integrity of sport.', 'No attempts to break, overload or reverse-engineer the platform.', 'No sending spam or harvesting other users\' data.']} />
      <p>We may suspend or remove accounts or content that break these rules.</p>
      <H>8. Liability</H>
      <p>The service is provided "as is". To the extent permitted by law, our total liability for any claim is limited to the fees you paid us in the 12 months before the claim, and we are not liable for indirect or consequential losses.</p>
      <H>9. Changes and termination</H>
      <p>We may update these terms; we will notify you of material changes. You may stop using the service at any time and request deletion of your account.</p>
      <H>10. Governing law</H>
      <p>These terms are governed by the laws of {LEGAL.jurisdiction}. Courts at the place of our registered office have jurisdiction.</p>
      <H>11. Contact</H>
      <p>{LEGAL.entity}, {LEGAL.address}. Email: {LEGAL.email}.</p>
    </Shell>
  );
}
