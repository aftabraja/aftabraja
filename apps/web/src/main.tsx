import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, homeFor, useAuth, type Role } from './lib/auth';
import { AppShell } from './components/AppShell';
import { VendorPanelProvider } from './components/VendorPanel';
import { Spinner } from './components/ui';
import Landing from './pages/Landing';
import { Privacy, Terms } from './pages/Legal';
import { ForgotPassword, SetPassword } from './pages/Password';
import { Login, Register } from './pages/Auth';
import { CreateLeague, LeaguesPage } from './pages/Leagues';
import LeagueDashboard from './pages/league/Dashboard';
import Playbook from './pages/league/Playbook';
import Teams from './pages/league/Teams';
import Management from './pages/league/Management';
import Players from './pages/league/Players';
import Sponsorships from './pages/league/Sponsorships';
import FindSponsors from './pages/league/FindSponsors';
import Finance from './pages/league/Finance';
import Documents from './pages/league/Documents';
import Settings from './pages/league/Settings';
import { DeckEditor, DeckList } from './pages/league/DeckStudio';
import { ContractEditor, ContractList } from './pages/league/Contracts';
import { Account, Marketplace, Messages, Notifications } from './pages/Common';
import { PlayerHome, SponsorHome, SponsorProfile, VendorHome } from './pages/Portals';
import Fixtures from './pages/league/Fixtures';
import MatchCenter from './pages/league/MatchCenter';
import AuctionRoom from './pages/league/Auction';
import { TrialDesk, TrialsList } from './pages/league/Trials';
import Logistics from './pages/league/Logistics';
import Ticketing from './pages/league/Ticketing';
import Accreditation from './pages/league/Accreditation';
import Reports from './pages/league/Reports';
import Procurement, { RfqDetail, WorkOrderDetail } from './pages/league/Procurement';
import { JerseyEditor, JerseyList } from './pages/league/Jerseys';
import TalentMarket from './pages/Talent';
import AgentHome from './pages/Agent';
import AccredApply from './pages/AccredApply';
import { PublicLeague, PublicMatch, TicketView } from './pages/Public';
import { AdminAudit, AdminLeagues, AdminOverview, AdminSponsors, AdminEmails, AdminTalent, AdminTransactions, AdminUsers, AdminVendors } from './pages/admin/Admin';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && user.role !== 'SUPER_ADMIN' && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="h-screen" />;
  return user ? <Navigate to={homeFor(user.role)} replace /> : <>{children}</>;
}

const LEAGUE_ROLES: Role[] = ['LEAGUE_OWNER', 'LEAGUE_STAFF', 'TEAM_OWNER'];

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <VendorPanelProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<SetPassword />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/l/:slug" element={<PublicLeague />} />
              <Route path="/l/:slug/match/:mid" element={<PublicMatch />} />
              <Route path="/ticket/:code" element={<TicketView />} />
              <Route path="/accreditation/apply/:slug" element={<AccredApply />} />
              <Route element={<Protected><AppShell /></Protected>}>
                <Route path="/leagues" element={<Protected roles={LEAGUE_ROLES}><LeaguesPage /></Protected>} />
                <Route path="/leagues/new" element={<Protected roles={['LEAGUE_OWNER']}><CreateLeague /></Protected>} />
                <Route path="/leagues/:leagueId" element={<LeagueDashboard />} />
                <Route path="/leagues/:leagueId/playbook" element={<Playbook />} />
                <Route path="/leagues/:leagueId/teams" element={<Teams />} />
                <Route path="/leagues/:leagueId/management" element={<Management />} />
                <Route path="/leagues/:leagueId/players" element={<Players />} />
                <Route path="/leagues/:leagueId/sponsorships" element={<Sponsorships />} />
                <Route path="/leagues/:leagueId/sponsors" element={<FindSponsors />} />
                <Route path="/leagues/:leagueId/finance" element={<Finance />} />
                <Route path="/leagues/:leagueId/documents" element={<Documents />} />
                <Route path="/leagues/:leagueId/settings" element={<Settings />} />
                <Route path="/leagues/:leagueId/decks" element={<DeckList />} />
                <Route path="/leagues/:leagueId/decks/:deckId" element={<DeckEditor />} />
                <Route path="/leagues/:leagueId/contracts" element={<ContractList />} />
                <Route path="/leagues/:leagueId/contracts/:contractId" element={<ContractEditor />} />
                <Route path="/leagues/:leagueId/fixtures" element={<Fixtures />} />
                <Route path="/leagues/:leagueId/matches/:mid" element={<MatchCenter />} />
                <Route path="/leagues/:leagueId/auction" element={<AuctionRoom />} />
                <Route path="/leagues/:leagueId/trials" element={<TrialsList />} />
                <Route path="/leagues/:leagueId/trials/:tid" element={<TrialDesk />} />
                <Route path="/leagues/:leagueId/logistics" element={<Logistics />} />
                <Route path="/leagues/:leagueId/tickets" element={<Ticketing />} />
                <Route path="/leagues/:leagueId/accreditation" element={<Accreditation />} />
                <Route path="/leagues/:leagueId/reports" element={<Reports />} />
                <Route path="/leagues/:leagueId/procurement" element={<Procurement />} />
                <Route path="/leagues/:leagueId/jerseys" element={<JerseyList />} />
                <Route path="/leagues/:leagueId/jerseys/:jid" element={<JerseyEditor />} />
                <Route path="/leagues/:leagueId/procurement/rfqs/:rid" element={<RfqDetail />} />
                <Route path="/leagues/:leagueId/procurement/work-orders/:wid" element={<WorkOrderDetail />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/talent" element={<Protected roles={['LEAGUE_OWNER', 'LEAGUE_STAFF', 'SPONSOR']}><TalentMarket /></Protected>} />
                <Route path="/agent" element={<Protected roles={['TALENT_AGENT']}><AgentHome /></Protected>} />
                <Route path="/admin/talent" element={<Protected roles={[]}><AdminTalent /></Protected>} />
                <Route path="/admin/emails" element={<Protected roles={[]}><AdminEmails /></Protected>} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:cid" element={<Messages />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/account" element={<Account />} />
                <Route path="/vendor" element={<Protected roles={['VENDOR']}><VendorHome /></Protected>} />
                <Route path="/sponsor" element={<Protected roles={['SPONSOR']}><SponsorHome /></Protected>} />
                <Route path="/sponsor/profile" element={<Protected roles={['SPONSOR']}><SponsorProfile /></Protected>} />
                <Route path="/player" element={<Protected roles={['PLAYER']}><PlayerHome /></Protected>} />
                <Route path="/admin" element={<Protected roles={[]}><AdminOverview /></Protected>} />
                <Route path="/admin/leagues" element={<Protected roles={[]}><AdminLeagues /></Protected>} />
                <Route path="/admin/users" element={<Protected roles={[]}><AdminUsers /></Protected>} />
                <Route path="/admin/vendors" element={<Protected roles={[]}><AdminVendors /></Protected>} />
                <Route path="/admin/sponsors" element={<Protected roles={[]}><AdminSponsors /></Protected>} />
                <Route path="/admin/transactions" element={<Protected roles={[]}><AdminTransactions /></Protected>} />
                <Route path="/admin/audit" element={<Protected roles={[]}><AdminAudit /></Protected>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </VendorPanelProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
