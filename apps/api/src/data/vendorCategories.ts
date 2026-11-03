/**
 * SportsIQ Vendor Taxonomy
 * Every service a league needs to plan, build, sell, deliver and close a season.
 * Groups -> categories -> typical services (used as suggestions when vendors list services).
 */

export interface VendorCategoryDef {
  slug: string;
  name: string;
  group: string;
  services: string[];
}

export const VENDOR_GROUPS = [
  'Venues & Infrastructure',
  'Cricket Operations & Officials',
  'Broadcast, Media & Technology',
  'Branding, Design & Creative',
  'Kits, Merchandise & Awards',
  'Events, Ceremonies & Entertainment',
  'Marketing, PR & Digital',
  'Travel, Hospitality & Logistics',
  'Safety, Security & Medical',
  'Legal, Finance & Compliance',
  'Staffing & Manpower',
  'Fan Experience & Ticketing',
] as const;

export const VENDOR_CATEGORIES: VendorCategoryDef[] = [
  // Venues & Infrastructure
  { slug: 'stadium-ground', name: 'Stadiums & Grounds', group: 'Venues & Infrastructure', services: ['Stadium hire per match', 'Ground hire per day', 'Turf ground', 'Indoor arena', 'Box cricket arena'] },
  { slug: 'practice-facility', name: 'Practice Nets & Academies', group: 'Venues & Infrastructure', services: ['Net sessions', 'Bowling machine', 'Indoor nets', 'Gym access'] },
  { slug: 'curator-groundstaff', name: 'Curators & Ground Staff', group: 'Venues & Infrastructure', services: ['Pitch preparation', 'Outfield maintenance', 'Covers & super-sopper', 'Ground markings'] },
  { slug: 'lighting-power', name: 'Floodlights & Generators', group: 'Venues & Infrastructure', services: ['Floodlight rental', 'Generator rental', 'Power distribution', 'Fuel supply'] },
  { slug: 'event-venue', name: 'Event & Banquet Venues', group: 'Venues & Infrastructure', services: ['Auction venue', 'Launch event venue', 'Awards night venue', 'Press conference hall'] },
  { slug: 'temporary-structures', name: 'Tents, Stands & Temporary Structures', group: 'Venues & Infrastructure', services: ['Temporary seating', 'German hangars', 'VIP enclosures', 'Dugouts', 'Commentary box'] },
  { slug: 'sanitation-housekeeping', name: 'Housekeeping & Sanitation', group: 'Venues & Infrastructure', services: ['Venue cleaning', 'Portable toilets', 'Waste management'] },

  // Cricket Operations & Officials
  { slug: 'umpires', name: 'Umpires', group: 'Cricket Operations & Officials', services: ['On-field umpire', 'Third umpire', 'Fourth umpire', 'Umpire panel'] },
  { slug: 'match-referee', name: 'Match Referees', group: 'Cricket Operations & Officials', services: ['Match referee per match', 'Tournament referee'] },
  { slug: 'scorers', name: 'Scorers & Statisticians', group: 'Cricket Operations & Officials', services: ['Official scorer', 'Digital scorer', 'Statistician', 'Analyst'] },
  { slug: 'coaching-staff', name: 'Coaches, Scouts & Selectors', group: 'Cricket Operations & Officials', services: ['Head coach', 'Batting coach', 'Bowling coach', 'Fielding coach', 'Talent scout', 'Selector'] },
  { slug: 'fitness-physio', name: 'Fitness Trainers & Physios', group: 'Cricket Operations & Officials', services: ['Strength & conditioning', 'Physiotherapist', 'Massage therapist', 'Nutritionist'] },
  { slug: 'integrity-officer', name: 'Anti-Corruption & Integrity', group: 'Cricket Operations & Officials', services: ['Integrity officer', 'ACU education session', 'Investigations'] },
  { slug: 'auctioneer', name: 'Auctioneers', group: 'Cricket Operations & Officials', services: ['Player auction host', 'Franchise auction host'] },
  { slug: 'sports-equipment', name: 'Sports Equipment Suppliers', group: 'Cricket Operations & Officials', services: ['Match balls', 'Stumps & bails', 'LED stumps', 'Boundary ropes', 'Sight screens', 'Bats & pads', 'Helmets & gloves'] },
  { slug: 'match-technology', name: 'Match Technology & Analytics', group: 'Cricket Operations & Officials', services: ['Ball tracking', 'Speed gun', 'Snickometer / Ultra-edge', 'DRS system', 'Performance analytics'] },

  // Broadcast, Media & Technology
  { slug: 'broadcast-production', name: 'Broadcast Production Houses', group: 'Broadcast, Media & Technology', services: ['Multi-camera production', 'OB van', 'Replays & slow-mo', 'Broadcast graphics', 'Spider cam', 'Drone camera'] },
  { slug: 'ott-streaming', name: 'OTT & Live Streaming', group: 'Broadcast, Media & Technology', services: ['YouTube live streaming', 'OTT platform rights', 'Streaming encoder setup', 'Internet bonding'] },
  { slug: 'commentators', name: 'Commentators & Experts', group: 'Broadcast, Media & Technology', services: ['English commentary', 'Hindi commentary', 'Regional commentary', 'Expert analyst'] },
  { slug: 'led-screens', name: 'LED Boards & Big Screens', group: 'Broadcast, Media & Technology', services: ['Perimeter LED boards', 'Giant replay screen', 'LED backdrop', 'Content operation'] },
  { slug: 'av-equipment', name: 'Audio-Visual Equipment', group: 'Broadcast, Media & Technology', services: ['PA system', 'Wireless mics', 'Projectors', 'Walkie-talkies'] },
  { slug: 'it-connectivity', name: 'IT, Wi-Fi & Connectivity', group: 'Broadcast, Media & Technology', services: ['Event Wi-Fi', 'Leased line', 'Laptops & printers rental', 'CCTV'] },
  { slug: 'photography-video', name: 'Photographers & Videographers', group: 'Broadcast, Media & Technology', services: ['Match photography', 'Team photoshoot', 'Highlights editing', 'Documentary', 'Reels creation'] },
  { slug: 'software-apps', name: 'Fantasy, Gaming & App Partners', group: 'Broadcast, Media & Technology', services: ['Fantasy game partner', 'League app development', 'Website development'] },

  // Branding, Design & Creative
  { slug: 'logo-design', name: 'Logo Designers', group: 'Branding, Design & Creative', services: ['League logo', 'Team logo', 'Logo refresh', 'Mascot design'] },
  { slug: 'branding-agency', name: 'Branding Agencies', group: 'Branding, Design & Creative', services: ['Brand identity kit', 'Brand guidelines', 'Naming', 'Brand strategy'] },
  { slug: 'jersey-design', name: 'Jersey & Kit Designers', group: 'Branding, Design & Creative', services: ['Jersey design', 'Training kit design', 'Kit mock-ups', 'Sponsor logo placement'] },
  { slug: 'graphic-design', name: 'Graphic Designers', group: 'Branding, Design & Creative', services: ['Social media creatives', 'Posters', 'Match-day graphics', 'Broadcast graphics package'] },
  { slug: 'presentation-design', name: 'Presentation & Deck Designers', group: 'Branding, Design & Creative', services: ['Sponsorship deck', 'Franchise sales deck', 'Investor deck'] },
  { slug: 'motion-graphics', name: 'Motion Graphics & Animation', group: 'Branding, Design & Creative', services: ['Logo animation', 'Intro video', 'Player cards animation', '3D trophy render'] },
  { slug: 'music-anthem', name: 'Music, Anthem & Jingles', group: 'Branding, Design & Creative', services: ['League anthem', 'Team anthem', 'Jingles', 'Stadium DJ'] },
  { slug: 'fabrication-branding', name: 'Fabrication & Ground Branding', group: 'Branding, Design & Creative', services: ['Boundary boards', 'Sight-screen branding', 'Backdrops', 'Podium', 'Entry arches', 'Standees'] },
  { slug: 'printing', name: 'Printing & ID Cards', group: 'Branding, Design & Creative', services: ['Accreditation cards', 'Lanyards', 'Flex printing', 'Brochures', 'Tickets printing'] },

  // Kits, Merchandise & Awards
  { slug: 'jersey-printing', name: 'Jersey Printers & Kit Manufacturers', group: 'Kits, Merchandise & Awards', services: ['Sublimation printing', 'Screen printing', 'Embroidery', 'Full kit (jersey, trouser, cap)', 'Training kits'] },
  { slug: 'merchandise', name: 'Merchandise Makers', group: 'Kits, Merchandise & Awards', services: ['Replica jerseys', 'Caps & hats', 'Flags & scarves', 'Mugs & keychains', 'Online merch store'] },
  { slug: 'trophy-medals', name: 'Trophy & Medal Makers', group: 'Kits, Merchandise & Awards', services: ['Championship trophy', 'Runner-up trophy', 'Individual awards', 'Medals', 'Mementos'] },
  { slug: 'gifting', name: 'Corporate Gifting & Welcome Kits', group: 'Kits, Merchandise & Awards', services: ['Player welcome kits', 'VIP hampers', 'Sponsor gifts'] },

  // Events, Ceremonies & Entertainment
  { slug: 'event-management', name: 'Event Management Companies', group: 'Events, Ceremonies & Entertainment', services: ['Opening ceremony', 'Closing ceremony', 'Launch event', 'Awards night', 'Auction event management'] },
  { slug: 'anchors-hosts', name: 'Anchors & Hosts', group: 'Events, Ceremonies & Entertainment', services: ['Event anchor', 'Auction host', 'Presentation ceremony host', 'Stadium MC'] },
  { slug: 'artists-performers', name: 'Artists, Celebrities & Performers', group: 'Events, Ceremonies & Entertainment', services: ['Singer / band', 'Dance troupe', 'Celebrity appearance', 'Cheerleaders', 'Mascot performer'] },
  { slug: 'sound-stage', name: 'Sound, Light & Stage', group: 'Events, Ceremonies & Entertainment', services: ['Stage setup', 'Concert sound', 'Stage lighting', 'Trussing'] },
  { slug: 'pyro-special-effects', name: 'Fireworks & Special Effects', group: 'Events, Ceremonies & Entertainment', services: ['Fireworks', 'Cold pyro', 'Confetti', 'Drone light show', 'Laser show'] },

  // Marketing, PR & Digital
  { slug: 'digital-marketing', name: 'Digital Marketing Agencies', group: 'Marketing, PR & Digital', services: ['Social media management', 'Paid ads', 'Content calendar', 'SEO', 'Contests'] },
  { slug: 'influencers', name: 'Influencers & Creators', group: 'Marketing, PR & Digital', services: ['Instagram promotion', 'YouTube promotion', 'Meet & greet'] },
  { slug: 'pr-agency', name: 'PR & Media Agencies', group: 'Marketing, PR & Digital', services: ['Press releases', 'Press conference', 'Media coverage', 'Crisis communication'] },
  { slug: 'advertising-ooh', name: 'Advertising & Outdoor (OOH)', group: 'Marketing, PR & Digital', services: ['Hoardings', 'Radio ads', 'Newspaper ads', 'Cinema ads', 'Bus branding'] },
  { slug: 'sponsorship-agency', name: 'Sponsorship Sales Agencies', group: 'Marketing, PR & Digital', services: ['Sponsorship sales', 'Valuation of inventory', 'Sponsor activation'] },

  // Travel, Hospitality & Logistics
  { slug: 'hotels', name: 'Hotels & Accommodation', group: 'Travel, Hospitality & Logistics', services: ['Team hotel', 'Officials hotel', 'Crew accommodation', 'Banquet hall'] },
  { slug: 'travel-agency', name: 'Travel Agencies (Flights & Trains)', group: 'Travel, Hospitality & Logistics', services: ['Group flight booking', 'Train booking', 'Visa assistance', 'Travel insurance'] },
  { slug: 'ground-transport', name: 'Buses, Cabs & Transport', group: 'Travel, Hospitality & Logistics', services: ['Team bus', 'Luxury cars', 'Airport transfers', 'Tempo traveller'] },
  { slug: 'catering', name: 'Catering & Food', group: 'Travel, Hospitality & Logistics', services: ['Player meals', 'Officials lunch', 'VIP hospitality', 'Crew meals', 'Food stalls'] },
  { slug: 'water-beverages', name: 'Water & Beverages', group: 'Travel, Hospitality & Logistics', services: ['Packaged water', 'Energy drinks', 'Ice supply'] },
  { slug: 'logistics-courier', name: 'Logistics & Courier', group: 'Travel, Hospitality & Logistics', services: ['Kit transport', 'Equipment logistics', 'Courier', 'Storage / warehousing'] },
  { slug: 'furniture-rental', name: 'Furniture & Equipment Rental', group: 'Travel, Hospitality & Logistics', services: ['Chairs & tables', 'Sofas for VIP', 'Coolers & fans', 'Barricades'] },

  // Safety, Security & Medical
  { slug: 'security', name: 'Security Agencies & Bouncers', group: 'Safety, Security & Medical', services: ['Venue security', 'Bouncers', 'Hotel security', 'Crowd management', 'Personal security officer'] },
  { slug: 'medical', name: 'Medical & Ambulance', group: 'Safety, Security & Medical', services: ['Ambulance on standby', 'Doctor on duty', 'First-aid team', 'Hospital tie-up'] },
  { slug: 'fire-safety', name: 'Fire & Safety', group: 'Safety, Security & Medical', services: ['Fire tender', 'Fire extinguishers', 'Safety audit'] },
  { slug: 'anti-doping', name: 'Anti-Doping & Testing', group: 'Safety, Security & Medical', services: ['Dope testing', 'Education sessions'] },

  // Legal, Finance & Compliance
  { slug: 'sports-lawyer', name: 'Sports & Corporate Lawyers', group: 'Legal, Finance & Compliance', services: ['Franchise agreements', 'Player contracts', 'Sponsor agreements', 'Broadcast agreements', 'Company registration'] },
  { slug: 'ip-trademark-lawyer', name: 'IP & Trademark Lawyers', group: 'Legal, Finance & Compliance', services: ['Trademark filing', 'Copyright', 'IP enforcement'] },
  { slug: 'chartered-accountant', name: 'Chartered Accountants & Auditors', group: 'Legal, Finance & Compliance', services: ['GST registration', 'Bookkeeping', 'TDS filing', 'Audit', 'Financial planning'] },
  { slug: 'insurance', name: 'Insurance Brokers', group: 'Legal, Finance & Compliance', services: ['Event liability insurance', 'Player accident insurance', 'Event cancellation cover', 'Equipment insurance'] },
  { slug: 'liaison-permissions', name: 'Permissions & Liaison Consultants', group: 'Legal, Finance & Compliance', services: ['Police permission', 'Fire NOC', 'Municipal approvals', 'PPL/IPRS licence', 'Drone permission'] },
  { slug: 'payment-gateway', name: 'Payments & Banking', group: 'Legal, Finance & Compliance', services: ['Payment gateway', 'POS machines', 'Escrow services'] },

  // Staffing & Manpower
  { slug: 'event-staff', name: 'Event Staff & Volunteers', group: 'Staffing & Manpower', services: ['Ushers', 'Ball boys/girls', 'Registration desk staff', 'Volunteers', 'Hostesses'] },
  { slug: 'team-managers', name: 'Team & Logistics Managers', group: 'Staffing & Manpower', services: ['Team manager', 'Liaison officer', 'Logistics coordinator', 'Tournament director'] },
  { slug: 'consultants', name: 'League Consultants', group: 'Staffing & Manpower', services: ['League setup consulting', 'Tournament operations', 'Commercial strategy'] },

  // Fan Experience & Ticketing
  { slug: 'ticketing', name: 'Ticketing Partners', group: 'Fan Experience & Ticketing', services: ['Online ticketing', 'Box office', 'QR scanning', 'Access control'] },
  { slug: 'fan-engagement', name: 'Fan Engagement & Activation', group: 'Fan Experience & Ticketing', services: ['Fan zones', 'Games & contests', 'Face painting', 'Photo booths'] },
  { slug: 'food-stalls', name: 'Food & Beverage Concessions', group: 'Fan Experience & Ticketing', services: ['Food stalls', 'Beverage counters', 'Mobile vending'] },
];

export const CATEGORY_SLUGS = new Set(VENDOR_CATEGORIES.map((c) => c.slug));
