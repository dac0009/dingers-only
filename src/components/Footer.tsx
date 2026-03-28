'use client';

export default function Footer() {
  return (
    <footer className="border-t border-dinger-border mt-8">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-xs font-mono text-dinger-muted">
            Data from{' '}
            <a
              href="https://baseballsavant.mlb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dinger-accent hover:underline"
            >
              Baseball Savant
            </a>
            {' '}via MLB Stats API
          </p>
          <p className="text-xs font-mono text-dinger-muted/60 mt-1">
            Stats refresh automatically every 5 minutes
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/game"
            className="text-xs font-mono text-dinger-muted hover:text-dinger-accent transition-colors"
          >
            ⚾ Batting Cage
          </a>
          <div className="font-display text-lg text-dinger-border tracking-tight">
            DINGERS<span className="text-dinger-accent/30"> ONLY</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
