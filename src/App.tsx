import React, { Suspense, lazy, useState, useCallback } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { useSupabaseData } from './hooks/useSupabaseData';
import Navbar from './components/Navbar';
import StatsBar from './components/StatsBar';
import UniverseBreakdown from './components/UniverseBreakdown';
import FilterBar from './components/FilterBar';
import MapContainer from './components/MapContainer';
import AskAI from './components/AskAI';

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

function Dashboard() {
  const { ttmSummary, userGroups, routeSummary, userGroupRegions, customerCounts, loading } = useSupabaseData();
  const { selectedRep, setSelectedRep } = useAppContext();
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);

  const handleCloseRep = useCallback(() => {
    setSelectedRep(null);
  }, [setSelectedRep]);

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
      {/* Fixed header stack */}
      <Navbar />
      <StatsBar
        userGroups={userGroups}
        userGroupRegions={userGroupRegions}
        ttmSummary={ttmSummary}
        loading={loading}
      />
      <UniverseBreakdown customerCounts={customerCounts} />
      <FilterBar userGroups={userGroups} />

      {/* Map area — fills remaining height */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {/* Map fills full area */}
        <div
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
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: leaderboardVisible ? 320 : 36,
            zIndex: 900,
            pointerEvents: 'auto',
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
                repData={ttmSummary.find(r => r.name === selectedRep) ?? null}
                routeSummary={routeSummary}
                onClose={handleCloseRep}
              />
            </Suspense>
          </div>
        )}

        {/* Layers panel — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            zIndex: 800,
            pointerEvents: 'auto',
          }}
        >
          <Suspense fallback={null}>
            <LayersPanel />
          </Suspense>
        </div>
      </div>

      {/* Ask AI — fixed, z-9999 */}
      <AskAI />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
