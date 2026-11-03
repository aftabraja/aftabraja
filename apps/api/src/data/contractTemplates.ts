/**
 * SportsIQ contract templates.
 *
 * IMPORTANT: These are generic, editable starting points provided for convenience only.
 * They are NOT legal advice, are not tailored to any jurisdiction or situation, and must be
 * reviewed and verified by a qualified lawyer before use. SportsIQ is not a party to any
 * agreement created from these templates.
 *
 * Placeholders use {{double_braces}} and are filled from league data and the user's inputs.
 */

export const LEGAL_DISCLAIMER =
  'IMPORTANT NOTICE: This document was generated from a generic SportsIQ template for reference purposes only. ' +
  'It does not constitute legal advice and may not be suitable for your situation or compliant with applicable laws. ' +
  'Please have it reviewed and verified by a qualified lawyer before signing or relying on it. ' +
  'SportsIQ is not a party to this agreement and accepts no responsibility or liability arising from its use.';

export interface ContractField { key: string; label: string; type?: 'text' | 'number' | 'date' }
export interface ContractTemplate {
  key: string;
  title: string;
  counterpartyLabel: string;
  description: string;
  fields: ContractField[];
  body: string;
}

const PARTIES = `This Agreement is made on {{agreement_date}} between:

1. {{league_entity}}, the organiser of {{league_name}} ("the League"); and
2. {{counterparty}} ("{{counterparty_role}}").

The League and {{counterparty_role}} are each a "Party" and together the "Parties".`;

const BOILERPLATE = `CONFIDENTIALITY
Each Party shall keep confidential the terms of this Agreement and any non-public information received from the other Party, except as required by law or with prior written consent.

TERMINATION
Either Party may terminate this Agreement by written notice if the other Party commits a material breach and fails to remedy it within {{cure_days}} days of written notice. Accrued rights and obligations survive termination.

FORCE MAJEURE
Neither Party is liable for failure or delay caused by events beyond its reasonable control (including weather, epidemic, government action or civil unrest). The Parties shall discuss in good faith any rescheduling or proportionate adjustment.

GOVERNING LAW AND DISPUTES
This Agreement is governed by the laws of {{governing_law}}. The Parties shall first attempt to resolve disputes amicably; failing which, disputes shall be referred to the courts / arbitration at {{jurisdiction}}.

ENTIRE AGREEMENT
This Agreement is the entire agreement between the Parties on its subject matter. Any amendment must be in writing and signed by both Parties.

SIGNED
For {{league_entity}}: ____________________   Name: {{league_signatory}}   Date: ________
For {{counterparty}}: ____________________   Name: ______________________   Date: ________`;

const common: ContractField[] = [
  { key: 'agreement_date', label: 'Agreement date', type: 'date' },
  { key: 'league_entity', label: 'League legal entity name' },
  { key: 'league_signatory', label: 'League signatory name' },
  { key: 'governing_law', label: 'Governing law (e.g. India)' },
  { key: 'jurisdiction', label: 'Jurisdiction / seat (e.g. Mumbai)' },
  { key: 'cure_days', label: 'Days to remedy a breach', type: 'number' },
];

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    key: 'franchise',
    title: 'League – Team Franchise Agreement',
    counterpartyLabel: 'Franchise owner / company',
    description: 'Grants a franchisee the right to own and operate a team in the league.',
    fields: [...common, { key: 'team_name', label: 'Team name' }, { key: 'franchise_fee', label: 'Franchise fee (₹)', type: 'number' }, { key: 'payment_terms', label: 'Payment terms / instalments' }, { key: 'term_seasons', label: 'Term (number of seasons)', type: 'number' }],
    body: `TEAM FRANCHISE AGREEMENT — {{league_name}}

${PARTIES}

1. GRANT OF FRANCHISE
The League grants the Franchisee the right to own and operate the team "{{team_name}}" in {{league_name}} for {{term_seasons}} season(s), commencing with the season starting {{season_start}}.

2. FRANCHISE FEE
The Franchisee shall pay a franchise fee of ₹{{franchise_fee}} (plus applicable taxes) as follows: {{payment_terms}}. Late payments may result in suspension of franchise rights after written notice.

3. LEAGUE RULES
The Franchisee shall comply with the League's playing conditions, code of conduct, anti-corruption rules, player auction rules, squad rules and any reasonable directions issued by the League.

4. BRANDING AND INTELLECTUAL PROPERTY
The League owns all rights in the League name, logo and competition. The Franchisee owns (or licenses) its team name and logo, subject to League approval and brand guidelines. Each Party grants the other a limited licence to use its marks solely to promote the League.

5. COMMERCIAL RIGHTS
League-level sponsorship, broadcast and ticketing rights belong to the League. Team-level sponsorship inventory permitted to the Franchisee will be as set out in the League's commercial guidelines and must not conflict with League category exclusivities.

6. TEAM OBLIGATIONS
The Franchisee shall field a complete squad, appoint support staff, attend scheduled matches and League events, and bear its own team costs unless otherwise agreed in writing.

7. REVENUE SHARE (IF ANY)
{{revenue_share}}

${BOILERPLATE}`,
  },
  {
    key: 'player',
    title: 'League / Team – Player Agreement',
    counterpartyLabel: 'Player full name',
    description: 'Engages a player for the season with fee, availability, conduct and image-rights terms.',
    fields: [...common, { key: 'team_name', label: 'Team name' }, { key: 'player_fee', label: 'Player fee (₹)', type: 'number' }, { key: 'payment_schedule', label: 'Payment schedule' }],
    body: `PLAYER AGREEMENT — {{league_name}}

${PARTIES}

1. ENGAGEMENT
The Player agrees to play for "{{team_name}}" in {{league_name}} during the season from {{season_start}} to {{season_end}}, including training, matches and official League and team events.

2. FEE
The Player shall be paid ₹{{player_fee}} (subject to applicable tax deductions) as follows: {{payment_schedule}}.

3. AVAILABILITY AND FITNESS
The Player confirms they are fit to play, will remain available for the season and will promptly disclose injuries. The Player confirms any required No-Objection Certificate (NOC) from their association or employer has been obtained.

4. CONDUCT AND INTEGRITY
The Player shall comply with the League's code of conduct, anti-corruption and anti-doping rules, and shall immediately report any approach to fix or manipulate any aspect of a match.

5. IMAGE RIGHTS
The Player grants the League and team a non-exclusive right to use the Player's name, image and likeness in connection with the League and team, but not as a personal endorsement of any third-party product without separate consent.

6. KIT AND SPONSORS
The Player shall wear official kit with sponsor branding as directed and shall not display conflicting commercial branding during League activities.

7. INSURANCE AND MEDICAL
{{insurance_terms}}

${BOILERPLATE}`,
  },
  {
    key: 'sponsorship',
    title: 'League – Sponsorship Agreement',
    counterpartyLabel: 'Sponsor company',
    description: 'Sponsorship package, fee, deliverables, exclusivity and branding approvals.',
    fields: [...common, { key: 'package_name', label: 'Package (e.g. Title Sponsor)' }, { key: 'sponsorship_fee', label: 'Sponsorship fee (₹)', type: 'number' }, { key: 'payment_terms', label: 'Payment terms' }, { key: 'deliverables', label: 'Deliverables (one per line)' }, { key: 'exclusivity', label: 'Category exclusivity (if any)' }],
    body: `SPONSORSHIP AGREEMENT — {{league_name}}

${PARTIES}

1. SPONSORSHIP
The Sponsor is appointed as "{{package_name}}" of {{league_name}} for the season from {{season_start}} to {{season_end}}.

2. FEE
The Sponsor shall pay ₹{{sponsorship_fee}} (plus applicable taxes) as follows: {{payment_terms}}.

3. DELIVERABLES
The League shall provide the following deliverables:
{{deliverables}}
The League will share reasonable proof of delivery (photos, screenshots, reports) after the season.

4. EXCLUSIVITY
{{exclusivity}}

5. BRANDING APPROVALS
The Sponsor shall provide logos and artwork in required formats by agreed deadlines. Each Party shall approve the other's use of its marks, such approval not to be unreasonably withheld.

6. MAKE-GOODS
If a deliverable cannot be provided for reasons within the League's control, the Parties shall agree a reasonable equivalent replacement or proportionate adjustment.

${BOILERPLATE}`,
  },
  {
    key: 'vendor',
    title: 'League – Vendor Service Agreement',
    counterpartyLabel: 'Vendor company',
    description: 'Scope of work, timelines, payment and quality obligations for any vendor.',
    fields: [...common, { key: 'service_description', label: 'Services / scope of work' }, { key: 'contract_value', label: 'Contract value (₹)', type: 'number' }, { key: 'payment_terms', label: 'Payment terms' }, { key: 'delivery_dates', label: 'Delivery dates / milestones' }],
    body: `VENDOR SERVICE AGREEMENT — {{league_name}}

${PARTIES}

1. SERVICES
The Vendor shall provide the following services for {{league_name}}: {{service_description}}.

2. TIMELINES
The Vendor shall deliver as per: {{delivery_dates}}. Time is of the essence for match-day deliverables.

3. FEES AND PAYMENT
The League shall pay ₹{{contract_value}} (plus applicable taxes) against valid tax invoices as follows: {{payment_terms}}.

4. QUALITY AND COMPLIANCE
The Vendor shall perform the services with due skill and care, using competent personnel, and shall hold all licences, registrations and insurances required by law for the services.

5. SAMPLES AND APPROVALS
Where applicable, the Vendor shall submit samples/mock-ups for approval before final production.

6. LIABILITY
The Vendor is responsible for its personnel, equipment and any damage caused by its negligence while performing the services.

${BOILERPLATE}`,
  },
  {
    key: 'venue',
    title: 'Venue / Ground Hire Agreement',
    counterpartyLabel: 'Venue owner / operator',
    description: 'Booking of stadium or grounds with dates, facilities and charges.',
    fields: [...common, { key: 'venue_name', label: 'Venue name & address' }, { key: 'booking_dates', label: 'Booking dates' }, { key: 'hire_charges', label: 'Hire charges (₹)', type: 'number' }, { key: 'facilities', label: 'Facilities included' }],
    body: `VENUE HIRE AGREEMENT — {{league_name}}

${PARTIES}

1. VENUE AND DATES
The Venue Owner grants the League use of {{venue_name}} on {{booking_dates}} for matches and related activities of {{league_name}}.

2. FACILITIES
Included facilities: {{facilities}}.

3. CHARGES
The League shall pay ₹{{hire_charges}} (plus applicable taxes) as agreed in writing, including any security deposit.

4. PERMISSIONS
The Parties shall cooperate to obtain all permissions required for the event. Responsibility for each permission shall be agreed in writing.

5. BRANDING AND BROADCAST
The League may install temporary branding and broadcast equipment and shall restore the venue to its original condition, fair wear and tear excepted.

${BOILERPLATE}`,
  },
  {
    key: 'broadcast',
    title: 'Broadcast / Streaming Partner Agreement',
    counterpartyLabel: 'Broadcaster / platform',
    description: 'Grant of media rights for live and highlights content.',
    fields: [...common, { key: 'territory', label: 'Territory' }, { key: 'rights_fee', label: 'Rights fee (₹, or 0 if revenue share)', type: 'number' }, { key: 'rights_scope', label: 'Rights granted (live, highlights, platforms)' }],
    body: `BROADCAST / STREAMING AGREEMENT — {{league_name}}

${PARTIES}

1. RIGHTS
The League grants the Broadcaster the following rights in {{territory}} for the season from {{season_start}} to {{season_end}}: {{rights_scope}}.

2. FEE
Consideration: ₹{{rights_fee}} (plus applicable taxes) and/or revenue share as agreed in writing.

3. PRODUCTION
Responsibility for production, feed quality, commentary and graphics shall be as agreed in writing. League sponsor branding in the feed shall be preserved.

4. OWNERSHIP
The League retains ownership of all match footage and data unless otherwise agreed.

${BOILERPLATE}`,
  },
  {
    key: 'nda',
    title: 'Mutual Non-Disclosure Agreement',
    counterpartyLabel: 'Other party',
    description: 'Protects confidential information shared during discussions.',
    fields: [...common, { key: 'purpose', label: 'Purpose of disclosure' }, { key: 'nda_years', label: 'Confidentiality period (years)', type: 'number' }],
    body: `MUTUAL NON-DISCLOSURE AGREEMENT

${PARTIES}

1. PURPOSE
The Parties wish to share confidential information for the purpose of: {{purpose}}.

2. OBLIGATIONS
Each Party shall use the other's confidential information only for the Purpose, protect it with reasonable care and disclose it only to personnel and advisers who need to know it and are bound by confidentiality.

3. EXCLUSIONS
Obligations do not apply to information that is public, already known, independently developed or required to be disclosed by law.

4. DURATION
These obligations last for {{nda_years}} year(s) from the date of this Agreement.

${BOILERPLATE}`,
  },
  {
    key: 'image-release',
    title: 'Image & Video Release Form',
    counterpartyLabel: 'Participant full name',
    description: 'Consent to use a person’s image in photos, video and broadcasts.',
    fields: [{ key: 'agreement_date', label: 'Date', type: 'date' }, { key: 'league_entity', label: 'League legal entity name' }],
    body: `IMAGE AND VIDEO RELEASE — {{league_name}}

I, {{counterparty}}, consent to {{league_entity}} and its partners photographing, filming and recording me in connection with {{league_name}}, and using such material in broadcasts, social media, websites and promotional materials related to the League, without separate payment.

This consent does not permit use of my image as a personal endorsement of any third-party product without my separate written consent. I may withdraw consent for future use by written notice, which will not affect material already published.

Signature: ____________________   Date: {{agreement_date}}`,
  },
];

export function fillTemplate(body: string, values: Record<string, string | number | null | undefined>) {
  return body.replace(/{{(\w+)}}/g, (_m, k) => {
    const v = values[k];
    if (v === undefined || v === null || v === '') return `[${k.replace(/_/g, ' ').toUpperCase()}]`;
    const n = typeof v === 'number' ? v : /^\d+$/.test(String(v)) && !k.includes('date') ? Number(v) : null;
    return n !== null && n >= 1000 ? n.toLocaleString('en-IN') : String(v);
  });
}
