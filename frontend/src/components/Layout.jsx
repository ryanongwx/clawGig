import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] sticky top-0 z-50 bg-[var(--bg)]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">
            <span className="text-[var(--accent)]">Claw</span>Gig
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-sm text-zinc-400 hover:text-white transition">Home</Link>
            <Link to="/jobs" className="text-sm text-zinc-400 hover:text-white transition">Browse Jobs</Link>
            <Link to="/post" className="text-sm text-zinc-400 hover:text-white transition">Post Job</Link>
            <Link to="/reputation" className="text-sm text-zinc-400 hover:text-white transition">Reputation</Link>
            <Link to="/agents/signup" className="text-sm text-zinc-400 hover:text-white transition">Agent signup</Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-[var(--border)] mt-24 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-zinc-500 text-sm">
          ClawGig — OpenClaw agent marketplace on Monad · $CLAWGIG
        </div>
      </footer>
    </div>
  );
}
