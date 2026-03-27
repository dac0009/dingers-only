'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeagueData, TeamStanding } from '@/lib/types';
import TeamLeaderboard from '@/components/TeamLeaderboard';
import PlayerLeaderboard from '@/components/PlayerLeaderboard';
import TeamModal from '@/components/TeamModal';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LeagueStatsHero from '@/components/LeagueStatsHero';
import SeasonProjections from '@/components/SeasonProjections';
import HRMap from '@/components/HRMap';

type Tab = 'teams' | 'players' | 'projections' | 'hrmap';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'teams', label: 'STANDINGS', icon: '🏆' },
  { id: 'players', label: 'PLAYERS', icon: '☄️' },
  { id: 'projections', label: 'PROJECTIONS', icon: '📊' },
  { id: 'hrmap', label: 'HR MAP', icon: '🗺️' },
];

export default function Home() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamStanding | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('teams');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/stats?season=2026');
      if (!res.ok) throw new Error('Failed to fetch');
      const json: LeagueData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError('Failed to load league data. Retrying...');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const managers = data
    ? [...new Set(data.teams.map((t) => t.manager))].sort()
    : [];

  return (
    <main className="min-h-screen">
      <Header lastUpdated={data?.lastUpdated ?? null} onRefresh={fetchData} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Tab switcher */}
        <div className="mb-8 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 bg-dinger-card border border-dinger-border rounded-xl p-1 min-w-max mx-auto w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 sm:px-4 rounded-lg font-display text-sm sm:text-base tracking-wide transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-dinger-accent text-dinger-bg'
                    : 'text-dinger-muted hover:text-dinger-text'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-dinger-border border-t-dinger-accent animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">
                ⚾
              </span>
            </div>
            <p className="font-body text-dinger-muted animate-pulse">
              Loading live stats from MLB...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-dinger-accent-hot text-lg mb-4">{error}</p>
            <button onClick={fetchData} className="admin-btn">
              Retry
            </button>
          </div>
        )}

        {/* Data loaded */}
        {data && !loading && (
          <>
            {(activeTab === 'teams' || activeTab === 'players') && (
              <LeagueStatsHero data={data} />
            )}

            {activeTab === 'teams' && (
              <div className="animate-fade-up">
                <TeamLeaderboard
                  teams={data.teams}
                  onSelectTeam={setSelectedTeam}
                />
              </div>
            )}

            {activeTab === 'players' && (
              <div className="animate-fade-up">
                <PlayerLeaderboard players={data.players} />
              </div>
            )}

            {activeTab === 'projections' && (
              <div className="animate-fade-up">
                <SeasonProjections data={data} />
              </div>
            )}

            {activeTab === 'hrmap' && (
              <div className="animate-fade-up">
                <HRMap managers={managers} />
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      {selectedTeam && (
        <TeamModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </main>
  );
}
