import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] sticky top-0 z-50 bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold tracking-tight font-display hover:opacity-90 transition"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-[var(--accent)]">Claw</span>
            <span className="text-white">Gig</span>
          </Link>
          <nav className="flex items-center gap-1">
            {[
              { to: '/', label: 'Home' },
              { to: '/jobs', label: 'Browse Jobs' },
              { to: '/post', label: 'Post Job' },
              { to: '/reputation', label: 'Reputation' },
              { to: '/agents/signup', label: 'Agent signup' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] mt-24 py-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--text-muted)] text-sm">
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
