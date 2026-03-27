'use client';

import { useState, useEffect } from 'react';

interface HREvent {
  player_name: string;
  player_id: number;
  hc_x: number;
  hc_y: number;
  hit_distance: number;
  exit_velo: number;
  launch_angle: number;
  game_date: string;
}

interface Props {
  managers: string[];
}

export default function HRMap({ managers }: Props) {
  const [selectedManager, setSelectedManager] = useState(managers[0] || '');
  const [events, setEvents] = useState<HREvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<HREvent | null>(null);

  useEffect(() => {
    if (!selectedManager) return;
    setLoading(true);
    fetch(`/api/hr-events?manager=${encodeURIComponent(selectedManager)}&season=2026`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
        else setEvents([]);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [selectedManager]);

  // Transform Statcast coordinates to SVG space
  // Statcast: home plate ~(126, 204), field extends up and out
  // SVG: we'll use a 300x300 viewport, home plate at (150, 280)
  const transformX = (hc_x: number) => ((hc_x - 126) / 126) * 130 + 150;
  const transformY = (hc_y: number) => ((hc_y - 204) / 204) * 230 + 280;

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dinger-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
            HR SPRAY CHART
          </h3>
        </div>
        <select
          value={selectedManager}
          onChange={(e) => setSelectedManager(e.target.value)}
          className="admin-input text-sm"
        >
          {managers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative max-w-md mx-auto">
          {/* Baseball Field SVG */}
          <svg viewBox="0 0 300 300" className="w-full" style={{ maxHeight: '400px' }}>
            {/* Grass background */}
            <defs>
              <radialGradient id="fieldGrad" cx="50%" cy="93%" r="75%">
                <stop offset="0%" stopColor="#1a3a1a" />
                <stop offset="100%" stopColor="#0d1f0d" />
              </radialGradient>
            </defs>

            {/* Outfield arc */}
            <path
              d="M 10 280 Q 150 -20 290 280 Z"
              fill="url(#fieldGrad)"
              stroke="#2a5a2a"
              strokeWidth="1"
            />

            {/* Warning track */}
            <path
              d="M 20 275 Q 150 0 280 275"
              fill="none"
              stroke="#3a2a1a"
              strokeWidth="8"
              opacity="0.3"
            />

            {/* Infield diamond */}
            <polygon
              points="150,210 190,250 150,280 110,250"
              fill="none"
              stroke="#5a4a2a"
              strokeWidth="1"
              opacity="0.4"
            />

            {/* Infield dirt */}
            <circle cx="150" cy="248" r="35" fill="#2a1f14" opacity="0.3" />

            {/* Baselines */}
            <line x1="150" y1="280" x2="30" y2="160" stroke="#5a4a2a" strokeWidth="0.5" opacity="0.4" />
            <line x1="150" y1="280" x2="270" y2="160" stroke="#5a4a2a" strokeWidth="0.5" opacity="0.4" />

            {/* Home plate */}
            <polygon
              points="150,280 146,276 146,272 154,272 154,276"
              fill="#e5e7eb"
              opacity="0.8"
            />

            {/* Bases */}
            <rect x="187" y="247" width="6" height="6" fill="#e5e7eb" opacity="0.6" transform="rotate(45 190 250)" />
            <rect x="147" y="207" width="6" height="6" fill="#e5e7eb" opacity="0.6" transform="rotate(45 150 210)" />
            <rect x="107" y="247" width="6" height="6" fill="#e5e7eb" opacity="0.6" transform="rotate(45 110 250)" />

            {/* HR dots */}
            {events.map((event, i) => {
              const x = transformX(event.hc_x);
              const y = transformY(event.hc_y);
              const isHovered = hoveredEvent === event;
              return (
                <g key={i}>
                  {/* Glow effect */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 12 : 6}
                    fill="rgba(245, 158, 11, 0.2)"
                    className="transition-all duration-200"
                  />
                  {/* Dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 6 : 4}
                    fill="#f59e0b"
                    stroke="#fbbf24"
                    strokeWidth="1"
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={() => setHoveredEvent(isHovered ? null : event)}
                  />
                </g>
              );
            })}

            {/* No HR message */}
            {!loading && events.length === 0 && (
              <text x="150" y="160" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="monospace">
                No home runs yet
              </text>
            )}

            {/* Loading */}
            {loading && (
              <text x="150" y="160" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="monospace">
                Loading spray data...
              </text>
            )}
          </svg>

          {/* Hover tooltip */}
          {hoveredEvent && (
            <div className="absolute top-4 left-4 bg-dinger-bg/95 border border-dinger-border rounded-xl p-3 shadow-xl max-w-[200px] pointer-events-none z-10">
              <p className="font-body font-semibold text-sm text-dinger-text-bright">
                {hoveredEvent.player_name}
              </p>
              <p className="text-xs text-dinger-muted mt-0.5">
                {hoveredEvent.game_date}
              </p>
              <div className="mt-2 space-y-1">
                {hoveredEvent.hit_distance > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-dinger-muted">Distance</span>
                    <span className="font-mono text-dinger-accent">{hoveredEvent.hit_distance} ft</span>
                  </div>
                )}
                {hoveredEvent.exit_velo > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-dinger-muted">Exit Velo</span>
                    <span className="font-mono text-dinger-text">{hoveredEvent.exit_velo} mph</span>
                  </div>
                )}
                {hoveredEvent.launch_angle > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-dinger-muted">Launch Angle</span>
                    <span className="font-mono text-dinger-text">{hoveredEvent.launch_angle}°</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs font-mono text-dinger-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            {events.length} HR{events.length !== 1 ? 's' : ''} tracked
          </span>
          <span>Click a dot for details</span>
        </div>
      </div>
    </div>
  );
}
