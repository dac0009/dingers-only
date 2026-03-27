'use client';

import { useState, useEffect, useCallback } from 'react';
import { RosterEntry, TransactionLog } from '@/lib/types';

interface SearchResult {
  id: number;
  name: string;
  team: string;
  hr: number;
}

export default function AdminPage() {
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionMode, setActionMode] = useState<'add' | 'swap' | null>(null);
  const [swapDropId, setSwapDropId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadManagers = useCallback(async () => {
    const res = await fetch('/api/roster?action=managers');
    const data = await res.json();
    setManagers(data);
    setLoading(false);
  }, []);

  const loadRoster = useCallback(async (manager: string) => {
    if (!manager) { setRoster([]); return; }
    const res = await fetch(`/api/roster?manager=${encodeURIComponent(manager)}`);
    const data = await res.json();
    setRoster(data);
  }, []);

  const loadTransactions = useCallback(async () => {
    const res = await fetch('/api/roster?action=transactions');
    const data = await res.json();
    setTransactions(data);
  }, []);

  useEffect(() => {
    loadManagers();
    loadTransactions();
  }, [loadManagers, loadTransactions]);

  useEffect(() => {
    loadRoster(selectedManager);
  }, [selectedManager, loadRoster]);

  // Debounced player search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/roster/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAdd = async (player: SearchResult) => {
    if (!selectedManager) {
      showMessage('error', 'Select a manager first');
      return;
    }

    const res = await fetch('/api/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        manager: selectedManager,
        playerId: player.id,
        playerName: player.name,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showMessage('success', `Added ${player.name} to ${selectedManager}`);
      loadRoster(selectedManager);
      loadTransactions();
      setSearchQuery('');
      setSearchResults([]);
      setActionMode(null);
    } else {
      showMessage('error', data.error);
    }
  };

  const handleDrop = async (playerId: number, playerName: string) => {
    if (!confirm(`Drop ${playerName} from ${selectedManager}?`)) return;

    const res = await fetch('/api/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'drop',
        manager: selectedManager,
        playerId,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showMessage('success', `Dropped ${playerName}`);
      loadRoster(selectedManager);
      loadTransactions();
    } else {
      showMessage('error', data.error);
    }
  };

  const handleSwap = async (addPlayer: SearchResult) => {
    if (!swapDropId || !selectedManager) return;

    const res = await fetch('/api/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'swap',
        manager: selectedManager,
        dropPlayerId: swapDropId,
        playerId: addPlayer.id,
        playerName: addPlayer.name,
      }),
    });

    const data = await res.json();
    if (data.success) {
      showMessage('success', `Swapped for ${addPlayer.name}`);
      loadRoster(selectedManager);
      loadTransactions();
      setSearchQuery('');
      setSearchResults([]);
      setActionMode(null);
      setSwapDropId(null);
    } else {
      showMessage('error', data.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-dinger-border border-t-dinger-accent animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-dinger-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl text-dinger-text-bright tracking-tight">
              ADMIN <span className="text-dinger-accent">PANEL</span>
            </h1>
            <p className="font-body text-sm text-dinger-muted mt-1">Roster Management</p>
          </div>
          <a
            href="/"
            className="text-sm font-mono text-dinger-muted hover:text-dinger-accent transition-colors flex items-center gap-1"
          >
            ← Back to League
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Status message */}
        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-xl border text-sm font-body ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Manager select + Roster */}
          <div className="lg:col-span-2 space-y-6">
            {/* Manager selector */}
            <div className="bg-dinger-card border border-dinger-border rounded-2xl p-6">
              <label className="block text-xs font-mono uppercase text-dinger-muted tracking-widest mb-2">
                Select Manager
              </label>
              <select
                value={selectedManager}
                onChange={(e) => {
                  setSelectedManager(e.target.value);
                  setActionMode(null);
                  setSwapDropId(null);
                }}
                className="admin-input w-full text-base"
              >
                <option value="">Choose a manager...</option>
                {managers.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Current roster */}
            {selectedManager && (
              <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-dinger-border flex items-center justify-between">
                  <h2 className="font-display text-xl text-dinger-text-bright">
                    {selectedManager}&apos;s Roster
                  </h2>
                  <span className="font-mono text-xs text-dinger-muted">
                    {roster.length} players
                  </span>
                </div>

                {roster.map((entry) => (
                  <div
                    key={entry.player_id}
                    className={`flex items-center justify-between px-6 py-3 border-b border-dinger-border/30 ${
                      swapDropId === entry.player_id ? 'bg-red-500/10' : ''
                    }`}
                  >
                    <div>
                      <span className="font-body text-dinger-text text-sm">
                        {entry.player_roster}
                      </span>
                      <span className="ml-2 font-mono text-xs text-dinger-muted">
                        #{entry.player_id}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (actionMode === 'swap' && swapDropId === entry.player_id) {
                            setActionMode(null);
                            setSwapDropId(null);
                          } else {
                            setActionMode('swap');
                            setSwapDropId(entry.player_id);
                            setSearchQuery('');
                            setSearchResults([]);
                          }
                        }}
                        className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all ${
                          swapDropId === entry.player_id
                            ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                            : 'border-dinger-border text-dinger-muted hover:border-amber-500/50 hover:text-amber-400'
                        }`}
                      >
                        {swapDropId === entry.player_id ? 'Cancel' : 'Swap'}
                      </button>
                      <button
                        onClick={() => handleDrop(entry.player_id, entry.player_roster)}
                        className="text-xs font-mono px-2.5 py-1 rounded-lg border border-dinger-border text-dinger-muted hover:border-red-500/50 hover:text-red-400 transition-all"
                      >
                        Drop
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add player button */}
                <div className="px-6 py-3">
                  <button
                    onClick={() => {
                      setActionMode(actionMode === 'add' ? null : 'add');
                      setSwapDropId(null);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className={`text-sm font-mono transition-all ${
                      actionMode === 'add'
                        ? 'text-dinger-accent'
                        : 'text-dinger-muted hover:text-dinger-accent'
                    }`}
                  >
                    {actionMode === 'add' ? '✕ Cancel' : '+ Add Player'}
                  </button>
                </div>
              </div>
            )}

            {/* Player search (for add/swap) */}
            {selectedManager && (actionMode === 'add' || (actionMode === 'swap' && swapDropId)) && (
              <div className="bg-dinger-card border border-dinger-border rounded-2xl p-6">
                <h3 className="font-display text-lg text-dinger-text-bright mb-3">
                  {actionMode === 'swap'
                    ? `Search replacement for ${roster.find((r) => r.player_id === swapDropId)?.player_roster ?? 'player'}`
                    : 'Search MLB Players'}
                </h3>
                <input
                  type="text"
                  placeholder="Type a player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-input w-full text-base mb-3"
                  autoFocus
                />

                {searching && (
                  <p className="text-xs text-dinger-muted font-mono animate-pulse">Searching...</p>
                )}

                {searchResults.length > 0 && (
                  <div className="border border-dinger-border rounded-xl overflow-hidden">
                    {searchResults.map((sr) => (
                      <div
                        key={sr.id}
                        className="flex items-center justify-between px-4 py-2.5 border-b border-dinger-border/30 row-glow"
                      >
                        <div>
                          <span className="font-body text-sm text-dinger-text">{sr.name}</span>
                          <span className="ml-2 font-mono text-xs text-dinger-muted">{sr.team}</span>
                          <span className="ml-2 font-mono text-xs text-amber-400">{sr.hr} HR</span>
                        </div>
                        <button
                          onClick={() =>
                            actionMode === 'swap' ? handleSwap(sr) : handleAdd(sr)
                          }
                          className="admin-btn text-xs py-1 px-3"
                        >
                          {actionMode === 'swap' ? 'Swap In' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-dinger-muted font-mono">No players found</p>
                )}
              </div>
            )}
          </div>

          {/* Right: Transaction log */}
          <div className="space-y-6">
            <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-dinger-border">
                <h2 className="font-display text-xl text-dinger-text-bright">
                  TRANSACTIONS
                </h2>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {transactions.length === 0 && (
                  <div className="px-5 py-8 text-center text-dinger-muted text-sm font-body">
                    No transactions yet
                  </div>
                )}
                {transactions.map((tx) => (
                  <div key={tx.id} className="px-5 py-3 border-b border-dinger-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        tx.type === 'add'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : tx.type === 'drop'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {tx.type.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-dinger-muted">
                        {new Date(tx.timestamp).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-body text-dinger-text">
                      <span className="font-semibold">{tx.manager}</span>
                      {tx.type === 'add' && tx.playerAdded && (
                        <> added <span className="text-emerald-400">{tx.playerAdded.name}</span></>
                      )}
                      {tx.type === 'drop' && tx.playerDropped && (
                        <> dropped <span className="text-red-400">{tx.playerDropped.name}</span></>
                      )}
                      {tx.type === 'swap' && tx.playerDropped && tx.playerAdded && (
                        <>
                          {' '}dropped <span className="text-red-400">{tx.playerDropped.name}</span>
                          {' '}for <span className="text-emerald-400">{tx.playerAdded.name}</span>
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
