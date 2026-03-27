'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeagueData, TeamStanding, PlayerStats } from '@/lib/types';
import TeamLeaderboard from '@/components/TeamLeaderboard';
import PlayerLeaderboard from '@/components/PlayerLeaderboard';
import TeamModal from '@/components/TeamModal';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamStanding | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');

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
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <main className="min-h-screen">
      <Header lastUpdated={data?.lastUpdated ?? null} onRefresh={fetchData} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-8 bg-dinger-card border border-dinger-border rounded-xl p-1 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-display text-lg tracking-wide transition-all duration-200 ${
              activeTab === 'teams'
                ? 'bg-dinger-accent text-dinger-bg'
                : 'text-dinger-muted hover:text-dinger-text'
            }`}
          >
            🏆 TEAM STANDINGS
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-display text-lg tracking-wide transition-all duration-200 ${
              activeTab === 'players'
                ? 'bg-dinger-accent text-dinger-bg'
                : 'text-dinger-muted hover:text-dinger-text'
            }`}
          >
            ☄️ PLAYER LEADERS
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-dinger-border border-t-dinger-accent animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-2xl">⚾</span>
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
            <button
              onClick={fetchData}
              className="admin-btn"
            >
              Retry
            </button>
          </div>
        )}

        {/* Data loaded */}
        {data && !loading && (
          <>
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
          </>
        )}
      </div>

      <Footer />

      {/* Team Detail Modal */}
      {selectedTeam && (
        <TeamModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </main>
  );
}
