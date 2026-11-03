# SPORTSIQ — Requirements & Status

Sources: **(A)** the League Software PDF, **(B)** your messages and feedback in chat.

Legend: ✅ Done · 🟡 Partly done · ❌ Not done · ⏸ Deferred by you

---

## Part A — Requirements from the League Software PDF

### 1. Vision & objectives
| Requirement | Status |
|---|---|
| Central operating system covering concept → closing | ✅ 13-phase, 66-step playbook |
| No Excel / WhatsApp needed | 🟡 Most work is in SportsIQ; no WhatsApp/email delivery yet |

### 2. User roles (access-controlled)
| Role | Status |
|---|---|
| Super Admin | ✅ |
| League Owner / Director | ✅ |
| League Operations Manager / management staff | ✅ (added by owner, by department) |
| Team Owner / Manager (incl. co-owners) | ✅ |
| Player | ✅ |
| Coach / Selector / Support staff | 🟡 Listed as vendors; no login role or team staff list |
| Match officials (umpires, scorers, referees) | 🟡 Vendors + accreditation; no login role |
| Vendors | ✅ |
| Sponsors / brand partners | ✅ |
| Media & broadcasters | 🟡 Accreditation applications only; no login role |
| Design & creative team | 🟡 Covered as management department |
| Legal & compliance team | 🟡 Covered as management department |
| Finance & accounts | 🟡 Covered as management department |
| Fans / public frontend | ✅ Public league page, live scores, tickets |
| Fine-grained permissions (view / edit / approve / download) | 🟡 Role-level only (owner / staff / team); not per department |

### 3. Global features
| Requirement | Status |
|---|---|
| Role-based secure login | ✅ |
| Global search (teams, players, vendors, contracts, matches, invoices) | 🟡 Vendor search only |
| Notification centre — in-app | ✅ |
| Notifications — email / SMS / WhatsApp | ❌ |
| Activity logs & audit history | ✅ (SuperAdmin view); ❌ league-level view |
| Central file library | 🟡 Playbook uploads only; contracts, receipts, decks not included |
| Comments & @mentions | ❌ |

### 4. Phase 0 — concept, strategy & approvals
| Requirement | Status |
|---|---|
| League concept workspace (name, format, city, dates, category, USPs) | ✅ |
| Attach reference decks / PDFs | ✅ Via playbook uploads |
| Visual roadmap of phases | ✅ |
| Milestones with owners and due dates | ❌ Steps have a responsible function, no assignee or due date |
| Top-level budget by category | ✅ |
| Planned vs actual | ✅ |

### 5. Deck design & documents
| Requirement | Status |
|---|---|
| Brand & template library (logos, colours, fonts, guidelines) | 🟡 League logo/colour + guideline upload; no font/palette manager |
| Pre-built decks: concept, sponsorship, team sales, broadcast, investor | ✅ |
| Slides auto-filled from data | ✅ |
| Add / remove / edit slides | ✅ |
| Replace images in slides | ❌ |
| Versions per sponsor | ✅ ("Prepared for") |
| Export PDF | ✅ |
| Export PPTX | ❌ |
| Secure view-only share links (expiry, watermark) | ❌ |

### 6. Legal & compliance
| Requirement | Status |
|---|---|
| Template library (franchise, player, vendor, sponsor, NDA, image release, broadcast) | ✅ (+ venue hire) |
| Talent release (anchors, celebrities) template | ❌ |
| Clause library with tags | ❌ |
| Version history per contract | ❌ |
| Smart contract wizard → Word/PDF | ✅ |
| "Verify with a lawyer" notice | ✅ On screen + in every export + acknowledgement |
| Configurable approval chain (Ops → Legal → Owner → Counterparty) | 🟡 Status only (Draft → Review → Sent → Signed) |
| E-sign | ⏸ Not built (legal caution) |
| Attach signed copies with timestamp | ❌ |
| Vendor KYC (PAN, GST, FSSAI, licences, insurance) | 🟡 GST number only |
| Expiry alerts for licences / contracts | ❌ |

### 7. Vendors & procurement
| Requirement | Status |
|---|---|
| Vendor categories | ✅ 70 categories in 12 groups |
| Vendor registration, profile, services, prices | ✅ |
| Vendor verification by admin | ✅ |
| Portfolio uploads (photos, videos, case studies) | ❌ |
| Ratings & reviews by leagues after a job | ❌ (rating shown, not collected) |
| RFQ — send requirement to many vendors | ❌ (one-to-one messaging only) |
| Compare quotes | ❌ |
| Select vendor → auto work order + contract draft | ❌ |
| Work orders with status, uploads, proofs, comments | ❌ |
| Jersey vendor search from jersey screen | ❌ |

### 8. Branding, creative & jerseys
| Requirement | Status |
|---|---|
| Brand assets manager (league / team / sponsor folders) | 🟡 Logos per league and team only |
| Jersey design studio (templates, colours, logos, name/number) | ❌ |
| Mandatory logo and sponsor-position rules | ❌ |
| Jersey design approval workflow | ❌ |
| Production package (vector files, sizes, sponsor map) | ❌ |
| Send to jersey vendor, sample / production / delivery tracking | ❌ |
| Other collateral tracking (hoardings, trophies, kits) | ❌ (vendors can be found; no tracker) |

### 9. Teams, players, trials & auction
| Requirement | Status |
|---|---|
| Team registration & approval | ✅ |
| Franchise financials (fee, instalments, receipts) | 🟡 Fee field + income entries; no instalment schedule |
| Team staff (coaches, physios, analysts) | ❌ |
| Detailed player profile | ✅ |
| Player registration windows and fees | ❌ |
| Player KYC (ID, age proof, NOC) | ❌ |
| Trial events, registration, QR check-in, evaluation, auto-shortlist | ✅ |
| Player catalogue with categories and base price | ✅ |
| Team purse | ✅ |
| Retention rules / right-to-match | ❌ |
| Real-time auction UI with timer | ✅ |
| Draft mode (serpentine picks) | ❌ |
| Squad rules: max players | ✅ |
| Squad rules: overseas/local ratio, role-balance warnings | ❌ |
| Final squads & spend summaries | ✅ |

### 10. Scheduling, fixtures & match operations
| Requirement | Status |
|---|---|
| Group stage, knockouts, double headers | ✅ |
| Auto-scheduler: venues, rest days, time slots | ✅ |
| Auto-scheduler: TV slots | ❌ |
| Match-day checklist per match ("ready for toss") | ❌ (playbook step only) |
| Toss, playing XI, ball-by-ball scoring | ✅ |
| Live scoreboard | ✅ (league + public fan page) |
| Text commentary | ❌ |
| Post-match summary & points table auto-update | ✅ |

### 11. Sponsorship & sales CRM
| Requirement | Status |
|---|---|
| Sponsorship inventory with value | ✅ |
| Sales pipeline (Lead → Contacted → Proposal → Negotiation → Won/Lost) | 🟡 Open / In discussion / Sold only |
| Communication notes, decks shared | 🟡 Via messages; not linked to pipeline |
| Sponsor-specific decks and contracts | ✅ |
| Deliverables tracking per sponsor with proof | ❌ |
| Sponsor deliverables dashboard | ❌ |

### 12. Marketing, PR & content
| Requirement | Status |
|---|---|
| Content calendar | ❌ |
| Creative asset management with tags | ❌ |
| Media contacts database | ❌ |
| Press release templates & tracking | ❌ |

### 13. Travel, hospitality & accommodation
| Requirement | Status |
|---|---|
| Travel planner (teams, officials, VIPs, staff) | ✅ |
| Hotel & rooming lists | ✅ |
| Itinerary per team, export PDF | ✅ |
| Share itinerary via WhatsApp | ❌ |

### 14. Ticketing, accreditation & fans
| Requirement | Status |
|---|---|
| Ticket categories, pricing, QR tickets, sales report | ✅ |
| Promo codes | ❌ |
| Accreditation categories, zone permissions, printable passes | ✅ (full module) |
| Fan database from ticketing | 🟡 Ticket buyers stored; no fan CRM |
| Surveys / NPS | ❌ |

### 15. Finance, payments & reports
| Requirement | Status |
|---|---|
| Category budget vs actual | ✅ |
| Actuals from vendor invoices, prize money, sponsorship, ticketing | ✅ |
| Receivables & payables with status | ✅ |
| Export Excel / CSV | ✅ (+ PDF) |
| Tally / Zoho / QuickBooks integration | ❌ |

### 16. Analytics, AI & alerts
| Requirement | Status |
|---|---|
| Owner operational dashboard | ✅ |
| Team & player performance stats | ✅ (batting / bowling reports) |
| Season-over-season comparison | ❌ (no multi-season) |
| AI: best dates & venues | ❌ |
| AI: vendor recommendations | ❌ |
| AI: contract clause suggestions | ❌ |
| AI: deck / press release drafting | ❌ |
| Alert: budget overshoot | ✅ |
| Alert: overdue vendor jobs | ❌ |
| Alert: expiring licences / contracts | ❌ |

### 17. Platform, security & scalability
| Requirement | Status |
|---|---|
| Modular API-first architecture | ✅ |
| Multi-league | ✅ |
| Multi-season per league | ❌ |
| Multi-timezone & multi-currency | ❌ (INR, IST) |
| RBAC | 🟡 Role-level (see §2) |
| Encryption in transit / at rest | 🟡 Depends on hosting (HTTPS + managed DB) — not deployed yet |
| Audit trails | ✅ |

---

## Part B — Your messages & feedback

| # | What you asked | Status |
|---|---|---|
| 1 | Platform name SPORTSIQ | ✅ |
| 2 | SaaS: leagues, members, players, vendors register | ✅ |
| 3 | Build fast as an individual project | ✅ 3 releases pushed |
| 4 | Every module matters — prioritise and build | 🟡 See Part A gaps |
| 5 | React + Node | ✅ |
| 6 | Vendors for everything a league needs (anchors, umpires, stadiums, production, logo designers, legal, jersey printers, trophy makers…) | ✅ 70 categories |
| 7 | Guided step-by-step setup: logo upload / AI logo / search vendor | ✅ |
| 7a | "Search vendor" splits screen into menu · dashboard · vendor list | ✅ |
| 8 | Deep research on league execution steps | ✅ 66 steps in 13 phases |
| 9 | Player profiles, hotels, room allotment, flights, schedule, playing XI, auction, trials, scoring app, expenses, P&L, progress bar | ✅ |
| 10 | White background, professional UI/UX | ✅ |
| 11 | Notifications, alerts, multiple roles | ✅ in-app · ❌ email/SMS/WhatsApp |
| 12 | Example CLT10: owner creates league, teams, owners/co-owners get logins, management profiles | ✅ |
| 13 | Subscription ₹5,000 league owner, lower for others | ✅ Plans set · 🟡 real payments need Razorpay keys |
| 14 | SuperAdmin sees and manages all data | ✅ |
| 15–16, 18 | ICC-level process; IPL-ready | 🟡 Process done; IPL scale needs deployment, storage, load testing |
| 17 | Other sports later | ⏸ Deferred by you |
| 19 | Register as sponsor; see leagues by month, progress, open categories, cost, deliverables; message owner | ✅ |
| 20 | League searches sponsors | ✅ |
| 21 | League ↔ vendor messaging | ✅ |
| 22 | League creates sponsorship opportunities with cost | ✅ |
| 23 | Monogram + logo | ✅ |
| 24 | Landing page: info, screenshots, register, pricing, functions | ✅ |
| 25 | Deck Studio (edit sample deck) or search deck vendors | ✅ (PDF; ❌ PPTX) |
| 26 | Legal contracts editable + "verify with lawyer" note; avoid legal hurdles | ✅ |
| 27 | Discuss before building | ✅ |
| 28 | Don't add multi-sport / mobile app now | ✅ Respected |
| 29 | Accreditation design & printing with rules and regulations | ✅ |
| 30 | Complete expense management, P&L, reports in every way, downloadable in formats | ✅ 31 reports · Excel / PDF / CSV |
| 31 | Agencies/managers list cricketers; brands approach for endorsements | ✅ |
| 32 | Managers list retired players; leagues hire legends | ✅ |

---

## Launch essentials (not in either list, but needed)
| Item | Status |
|---|---|
| Forgot / reset password | ❌ |
| Email sending (invites, receipts, alerts) | ❌ |
| Privacy Policy & Terms of Service pages | ❌ |
| Login rate limiting | ❌ |
| File storage (S3) instead of database | ❌ |
| Automated tests + CI | ❌ (demo-season script only) |
| GST invoice for subscriptions | ❌ |
| Production deployment | ❌ |
