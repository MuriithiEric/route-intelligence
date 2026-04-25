import React, { Suspense, lazy, useState, useCallback, useRef, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useAuth } from './hooks/useAuth';
import type { KRIUser } from './hooks/useAuth';
import Navbar from './components/Navbar';
import StatsBar from './components/StatsBar';
import UniverseBreakdown from './components/UniverseBreakdown';
import FilterBar from './components/FilterBar';
import MapContainer from './components/MapContainer';
import AskAI from './components/AskAI';
import OnboardingTour from './components/OnboardingTour';
import LoginPage from './components/LoginPage';
import CustomerUniversePanel from './components/CustomerUniversePanel';
import ComparePanel from './components/ComparePanel';

// Lazy-loaded panels
const LeaderboardPanel = lazy(() => import('./components/LeaderboardPanel'));
const RepActivityPanel = lazy(() => import('./components/RepActivityPanel'));
const LayersPanel = lazy(() => import('./components/LayersPanel'));

function PanelSkeleton({ width }: { width?: number }) {
  return (
    <div
      style={{
        width: width || '100%',
        height: '100%',
        background: '#FFFFFF',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
      }}
    />
  );
}

interface DashboardProps {
  isTourCompleted: boolean;
  onTourComplete: () => Promise<void>;
  onSignOut: () => void;
  user: KRIUser | null;
}

function Dashboard({ isTourCompleted, onTourComplete, onSignOut, user }: DashboardProps) {
  const { ttmSummary, userGroups, routeSummary, userGroupRegions, customerCounts, routeCount, loading } = useSupabaseData();
  const {
    selectedRep, setSelectedRep,
    compareMode, compareRep1, compareRep2, setCompareMode, setCompareRep1, setCompareRep2,
    showUniversePanel, setShowUniversePanel,
  } = useAppContext();
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const tourTriggerRef = useRef<(() => void) | null>(null);

  const handleCloseRep = useCallback(() => {
    setSelectedRep(null);
  }, [setSelectedRep]);

  // FIX 8c: keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ESC: close panels / exit compare mode
      if (e.key === 'Escape') {
        if (showUniversePanel) {
          setShowUniversePanel(false);
          return;
        }
        if (compareMode) {
          setCompareMode(false);
          setCompareRep1(null);
          setCompareRep2(null);
          return;
        }
        if (selectedRep) {
          setSelectedRep(null);
          return;
        }
      }
      // /: focus leaderboard search
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        const el = document.getElementById('leaderboard-search');
        if (el) (el as HTMLInputElement).focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedRep, compareMode, showUniversePanel, setSelectedRep, setCompareMode, setCompareRep1, setCompareRep2, setShowUniversePanel]);

  const showComparePanel = compareMode && (compareRep1 || compareRep2);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#FAF7F2',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <OnboardingTour
        triggerRef={tourTriggerRef}
        isTourCompleted={isTourCompleted}
        onComplete={onTourComplete}
      />

      {/* Fixed header stack */}
      <Navbar
        onTourClick={() => tourTriggerRef.current?.()}
        user={user}
        onSignOut={onSignOut}
      />
      <div data-tour="statsbar">
        <StatsBar
          userGroups={userGroups}
          userGroupRegions={userGroupRegions}
          ttmSummary={ttmSummary}
          customerCounts={customerCounts}
          loading={loading}
        />
      </div>
      <div data-tour="universe">
        <UniverseBreakdown customerCounts={customerCounts} />
      </div>
      <div data-tour="filterbar">
        <FilterBar userGroups={userGroups} ttmSummary={ttmSummary} />
      </div>

      {/* Map area — fills remaining height */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Map fills full area */}
        <div
          data-tour="map"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
          }}
        >
          <MapContainer ttmSummary={ttmSummary} routeSummary={routeSummary} />
        </div>

        {/* Leaderboard — right side */}
        <div
          data-tour="leaderboard"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: showComparePanel ? '60vh' : 0,
            width: leaderboardVisible ? 320 : 36,
            zIndex: 900,
            pointerEvents: 'auto',
            transition: 'bottom 0.3s ease-out',
          }}
        >
          <Suspense fallback={<PanelSkeleton width={leaderboardVisible ? 320 : 36} />}>
            <LeaderboardPanel
              ttmSummary={ttmSummary}
              userGroupRegions={userGroupRegions}
              isVisible={leaderboardVisible}
              onToggle={() => setLeaderboardVisible(v => !v)}
              filterBarBottom={0}
            />
          </Suspense>
        </div>

        {/* Rep Activity Panel — slides over leaderboard */}
        {selectedRep && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 380,
              zIndex: 901,
              pointerEvents: 'auto',
            }}
          >
            <Suspense fallback={<PanelSkeleton width={380} />}>
              <RepActivityPanel
                repName={selectedRep}
                repData={ttmSummary.find(r => r.raw_name === selectedRep) ?? null}
                onClose={handleCloseRep}
              />
            </Suspense>
          </div>
        )}

        {/* Layers panel — bottom left */}
        <div
          data-tour="layers"
          style={{
            position: 'absolute',
            bottom: showComparePanel ? 'calc(60vh + 16px)' : 0,
            left: 0,
            zIndex: 800,
            pointerEvents: 'auto',
            transition: 'bottom 0.3s ease-out',
          }}
        >
          <Suspense fallback={null}>
            <LayersPanel
              fieldStaffCount={ttmSummary.length || undefined}
              customerCount={customerCounts?.total || undefined}
              routeCount={routeCount ?? undefined}
            />
          </Suspense>
        </div>
      </div>

      {/* FIX 7: Compare panel — slides up from bottom */}
      {showComparePanel && (
        <ComparePanel ttmSummary={ttmSummary} />
      )}

      {/* FIX 4: Customer Universe slide-over panel */}
      {showUniversePanel && (
        <CustomerUniversePanel
          customerCounts={customerCounts}
          ttmSummary={ttmSummary}
          onClose={() => setShowUniversePanel(false)}
        />
      )}

      {/* Ask AI — fixed, z-9999 */}
      <AskAI ttmSummary={ttmSummary} userGroups={userGroups} customerCounts={customerCounts} />
    </div>
  );
}

function AuthGate() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div
        style={{
          height: '100vh',
          background: 'linear-gradient(135deg, #1E3A5F 0%, #0F2240 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
            <path d="M3 14L9 4L15 14H3Z" fill="#C9963E" />
            <circle cx="9" cy="10" r="2" fill="white" />
          </svg>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginPage onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  }

  return (
    <AppProvider>
      <Dashboard
        isTourCompleted={auth.isTourCompleted}
        onTourComplete={auth.markTourComplete}
        onSignOut={auth.signOut}
        user={auth.user}
      />
    </AppProvider>
  );
}

export default function App() {
  return <AuthGate />;
}
