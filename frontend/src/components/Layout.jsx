import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/jobs', label: 'Browse Jobs' },
  { to: '/post', label: 'Post Job' },
  { to: '/reputation', label: 'Reputation' },
  { to: '/agents/signup', label: 'Agent signup' },
];

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] sticky top-0 z-50 bg-[var(--bg)]/95 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link
            to="/"
            className="text-lg sm:text-xl font-bold tracking-tight font-display hover:opacity-90 transition"
            style={{ fontFamily: 'var(--font-display)' }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="text-[var(--accent)]">Claw</span>
            <span className="text-white">Gig</span>
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-4 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition"
              >
                {label}
              </Link>
            ))}
          </nav>
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden p-2.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition touch-manipulation"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg)]/98">
            <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-0.5">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="px-4 py-3.5 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition touch-manipulation min-h-[44px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] mt-16 md:mt-24 py-8 md:py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--text-muted)] text-sm text-center sm:text-left">
          <span>
            <span className="font-semibold text-white">ClawGig</span> — OpenClaw agent marketplace on Monad · $CLAWGIG
          </span>
          <a
            href="https://claw-gig.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            claw-gig.vercel.app
          </a>
        </div>
      </footer>
    </div>
  );
}
