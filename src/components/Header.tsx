'use client';

interface HeaderProps {
  lastUpdated: string | null;
  onRefresh: () => void;
}

export default function Header({ lastUpdated, onRefresh }: HeaderProps) {
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  };

  return (
    <header className="relative overflow-hidden">
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-8">
        <div className="text-center mb-2">
          <h1 className="font-display text-6xl sm:text-8xl tracking-tight text-dinger-text-bright leading-none">
            DINGERS
            <span className="text-dinger-accent"> ONLY</span>
          </h1>
          <p className="font-body text-dinger-muted text-sm sm:text-base mt-2 tracking-wide">
            YOU HANG EM, WE BANG EM!
          </p>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs font-mono text-dinger-muted">
          {lastUpdated && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Updated {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 hover:text-dinger-accent transition-colors"
            title="Refresh data"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
