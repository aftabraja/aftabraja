import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BookOpenCheck, Building2, ChevronDown, CircleDollarSign, FileText, Handshake, LayoutDashboard, LogOut, Menu,
  MessageSquare, Search, Settings, Shield, ShieldCheck, Store, Trophy, User as UserIcon, Users, UsersRound, Wallet, X, ScrollText, Megaphone, Presentation, FileSignature, Gavel, CalendarDays, Plane, ClipboardCheck, Ticket, IdCard, BarChart3, Star, Mail, ClipboardList, Shirt, CheckCircle2, Newspaper,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { get, post } from '../lib/api';
import { ago, ROLE_LABEL } from '../lib/format';
import { Avatar, cx } from './ui';
import { Logo } from './Logo';
import { useVendorPanel, VendorPane } from './VendorPanel';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

function useNav(): { title?: string; items: NavItem[] }[] {
  const { user } = useAuth();
  const m = useMatch('/leagues/:leagueId/*');
  const leagueId = m?.params.leagueId;
  const league = useQuery({ queryKey: ['league', leagueId], queryFn: () => get(`/leagues/${leagueId}`), enabled: !!leagueId && leagueId !== 'new' });
  const i = (C: any) => <C className="h-4 w-4" />;
  const common: NavItem[] = [
    { to: '/marketplace', label: 'Vendor Marketplace', icon: i(Store) },
    { to: '/messages', label: 'Messages', icon: i(MessageSquare) },
    { to: '/notifications', label: 'Notifications', icon: i(Bell) },
  ];
  if (!user) return [];
  switch (user.role) {
    case 'SUPER_ADMIN':
      return [
        { title: 'Super Admin', items: [
          { to: '/admin', label: 'Overview', icon: i(LayoutDashboard), end: true },
          { to: '/admin/leagues', label: 'Leagues', icon: i(Trophy) },
          { to: '/admin/users', label: 'Users & Subscriptions', icon: i(Users) },
          { to: '/admin/vendors', label: 'Vendors', icon: i(Store) },
          { to: '/admin/sponsors', label: 'Sponsors & Inventory', icon: i(Handshake) },
          { to: '/admin/talent', label: 'Agencies & Talent', icon: i(Star) },
          { to: '/admin/transactions', label: 'Transactions', icon: i(Wallet) },
          { to: '/admin/emails', label: 'Email Outbox', icon: i(Mail) },
          { to: '/admin/audit', label: 'Audit Log', icon: i(ScrollText) },
        ] },
        ...(leagueId && league.data ? leagueNav(leagueId, league.data, i) : []),
        { title: 'Platform', items: common },
      ];
    case 'VENDOR':
      return [{ title: 'My Business', items: [{ to: '/vendor', label: 'Profile & Services', icon: i(Building2), end: true }, ...common] }];
    case 'TALENT_AGENT':
      return [{ title: 'Agency', items: [
        { to: '/agent', label: 'Roster & Enquiries', icon: i(Star), end: true },
        { to: '/messages', label: 'Messages', icon: i(MessageSquare) }, { to: '/notifications', label: 'Notifications', icon: i(Bell) },
      ] }];
    case 'SPONSOR':
      return [{ title: 'Sponsor', items: [
        { to: '/sponsor', label: 'League Marketplace', icon: i(Trophy), end: true },
        { to: '/sponsor/deals', label: 'My Sponsorships', icon: i(CheckCircle2) },
        { to: '/talent', label: 'Cricketers for Endorsement', icon: i(Star) },
        { to: '/sponsor/profile', label: 'Company Profile', icon: i(Building2) },
        { to: '/messages', label: 'Messages', icon: i(MessageSquare) }, { to: '/notifications', label: 'Notifications', icon: i(Bell) },
      ] }];
    case 'PLAYER':
      return [{ title: 'Player', items: [
        { to: '/player', label: 'My Profile & Leagues', icon: i(UserIcon), end: true },
        { to: '/messages', label: 'Messages', icon: i(MessageSquare) }, { to: '/notifications', label: 'Notifications', icon: i(Bell) },
      ] }];
    default:
      return [
        { items: [{ to: '/leagues', label: 'My Leagues', icon: i(Trophy), end: true }] },
        ...(leagueId && league.data ? leagueNav(leagueId, league.data, i) : []),
        { title: 'Workspace', items: [...common.slice(0, 1), ...(user.role === 'TEAM_OWNER' ? [] : [{ to: '/talent', label: 'Legends & Talent', icon: i(Star) }]), ...common.slice(1)] },
      ];
  }
}

function leagueNav(id: string, league: any, i: (C: any) => ReactNode): { title?: string; items: NavItem[] }[] {
  const base = `/leagues/${id}`;
  const team = league.access === 'team';
  const head = { title: league.shortCode || league.name, items: [
    { to: base, label: 'Dashboard', icon: i(LayoutDashboard), end: true },
    { to: `${base}/playbook`, label: 'Execution Playbook', icon: i(BookOpenCheck) },
  ] };
  if (team) return [head, { title: 'My team', items: [
    { to: `${base}/teams`, label: 'My Team', icon: i(Shield) },
    { to: `${base}/players`, label: 'Players', icon: i(UsersRound) },
    { to: `${base}/auction`, label: 'Live Auction', icon: i(Gavel) },
    { to: `${base}/fixtures`, label: 'Fixtures & Results', icon: i(CalendarDays) },
    { to: `${base}/logistics`, label: 'Team Itinerary', icon: i(Plane) },
    { to: `${base}/jerseys`, label: 'Jersey Studio', icon: i(Shirt) },
  ] }];
  return [
    head,
    { title: 'Season operations', items: [
      { to: `${base}/teams`, label: 'Teams & Owners', icon: i(Shield) },
      { to: `${base}/players`, label: 'Players', icon: i(UsersRound) },
      { to: `${base}/trials`, label: 'Trials', icon: i(ClipboardCheck) },
      { to: `${base}/auction`, label: 'Live Auction', icon: i(Gavel) },
      { to: `${base}/fixtures`, label: 'Fixtures & Scoring', icon: i(CalendarDays) },
      { to: `${base}/logistics`, label: 'Travel & Hotels', icon: i(Plane) },
      { to: `${base}/jerseys`, label: 'Jersey Studio', icon: i(Shirt) },
      { to: `${base}/accreditation`, label: 'Accreditation', icon: i(IdCard) },
      { to: `${base}/tickets`, label: 'Ticketing', icon: i(Ticket) },
    ] },
    { title: 'Business', items: [
      { to: `${base}/procurement`, label: 'Procurement', icon: i(ClipboardList) },
      { to: `${base}/sponsorships`, label: 'Sponsorship Inventory', icon: i(Megaphone) },
      { to: `${base}/crm`, label: 'Sponsor CRM', icon: i(Handshake) },
      { to: `${base}/sponsors`, label: 'Find Sponsors', icon: i(Search) },
      { to: `${base}/marketing`, label: 'Marketing & PR', icon: i(Newspaper) },
      { to: `${base}/finance`, label: 'Finance & P&L', icon: i(CircleDollarSign) },
      { to: `${base}/reports`, label: 'Reports', icon: i(BarChart3) },
      { to: `${base}/decks`, label: 'Deck Studio', icon: i(Presentation) },
      { to: `${base}/contracts`, label: 'Legal Contracts', icon: i(FileSignature) },
    ] },
    { title: 'Admin', items: [
      { to: `${base}/management`, label: 'Management Team', icon: i(Users) },
      { to: `${base}/documents`, label: 'Documents', icon: i(FileText) },
      { to: `${base}/settings`, label: 'League Settings', icon: i(Settings) },
    ] },
  ];
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const n = useQuery({ queryKey: ['notifications'], queryFn: () => get<{ items: any[]; unread: number }>('/notifications'), refetchInterval: 30_000 });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const tone: Record<string, string> = { success: 'bg-emerald-500', alert: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-brand-500' };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {!!n.data?.unread && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{n.data.unread > 9 ? '9+' : n.data.unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => readAll.mutate()}>Mark all read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!n.data?.items.length && <p className="p-6 text-center text-sm text-ink-500">You're all caught up.</p>}
              {n.data?.items.slice(0, 12).map((x) => (
                <button key={x.id} onClick={() => { setOpen(false); post(`/notifications/${x.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })); if (x.link) nav(x.link); }}
                  className={cx('flex w-full gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50', !x.readAt && 'bg-brand-50/40')}>
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone[x.type] ?? tone.info, x.readAt && 'opacity-30')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-900">{x.title}</span>
                    {x.body && <span className="block truncate text-xs text-ink-500">{x.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-ink-400">{ago(x.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
            <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 py-2.5 text-center text-xs font-semibold text-brand-700 hover:bg-ink-50">View all</Link>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  if (!user) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-ink-100">
        <Avatar name={user.name} size={32} />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight">{user.name}</span>
          <span className="block text-[11px] text-ink-500">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop">
            <div className="border-b border-ink-100 px-4 py-2.5"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-ink-500">{user.email}</p></div>
            <Link to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-ink-50"><UserIcon className="h-4 w-4" />Account & subscription</Link>
            <button onClick={() => { logout(); nav('/'); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Log out</button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const sections = useNav();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openVendors, state } = useVendorPanel();
  const loc = useLocation();
  const leagueId = useMatch('/leagues/:leagueId/*')?.params.leagueId;
  const unread = useQuery({ queryKey: ['unread-messages'], queryFn: () => get<{ count: number }>('/messages/unread-count'), refetchInterval: 30_000 });
  const canSearchVendors = user && !['VENDOR', 'PLAYER', 'SPONSOR', 'TALENT_AGENT'].includes(user.role);

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-100 px-5"><Link to="/"><Logo size={30} /></Link></div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((s, idx) => (
          <div key={idx}>
            {s.title && <p className="mb-2 truncate px-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">{s.title}</p>}
            <div className="space-y-0.5">
              {s.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900')}>
                  {it.icon}<span className="truncate">{it.label}</span>
                  {it.to === '/messages' && !!unread.data?.count && <span className="ml-auto rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">{unread.data.count}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
      {user?.role === 'SUPER_ADMIN' && <div className="m-3 flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2.5 text-xs font-semibold text-white"><ShieldCheck className="h-4 w-4 text-amber-400" />Super Admin access</div>}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-ink-200 bg-white lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-ink-100" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-ink-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          {canSearchVendors && (
            <button onClick={() => openVendors(undefined, leagueId)} className={cx('flex h-10 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-sm text-ink-500 transition hover:border-brand-200 hover:bg-white', state.open && 'border-brand-500 bg-white')}>
              <Search className="h-4 w-4 shrink-0" /><span className="truncate">Search vendors — stadiums, umpires, jersey printers, anchors…</span>
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Link to="/messages" className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Messages">
              <MessageSquare className="h-5 w-5" />
              {!!unread.data?.count && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600" />}
            </Link>
            <NotificationBell />
            <div className="mx-1 h-6 w-px bg-ink-200" />
            <UserMenu />
          </div>
        </header>
        <main key={loc.pathname.split('/').slice(0, 3).join('/')} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <VendorPane />
    </div>
  );
}
