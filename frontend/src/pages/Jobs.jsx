import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { browseJobs } from '../api/client';

function formatBounty(wei) {
  if (!wei) return '—';
  const n = BigInt(wei);
  if (n < 1e15) return `${Number(n) / 1e18} MONAD`;
  return `${(Number(n) / 1e18).toFixed(4)} MONAD`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('open');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    browseJobs({ status, limit: 50 })
      .then((data) => { if (!cancelled) setJobs(data.jobs || []); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
        <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Browse Jobs</h1>
        <Link to="/post" className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold">
          Post Job
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {['open', 'claimed', 'submitted', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${status === s ? 'btn-primary' : 'btn-outline bg-[var(--card)]/50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-[var(--text-muted)] py-16 text-center">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="card-glow py-16 text-center rounded-2xl text-[var(--text-muted)]">
          No {status} jobs. <Link to="/post" className="text-[var(--accent)] hover:underline font-medium">Post one</Link>.
        </div>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.jobId} className="card-glow p-6 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[var(--accent)]/80 text-sm font-mono">#{job.jobId}</span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-[var(--text-muted)] border border-[var(--border)]">{job.status}</span>
                  </div>
                  <p className="text-white font-medium mb-1 line-clamp-2">{job.description}</p>
                  <p className="text-[var(--text-muted)] text-sm">Bounty: {formatBounty(job.bounty)} · Deadline: {formatDate(job.deadline)}</p>
                  {job.issuer && <p className="text-zinc-500 text-xs mt-1 font-mono">Issuer: {job.issuer.slice(0, 10)}…</p>}
                </div>
                <Link
                  to={`/jobs/${job.jobId}`}
                  className="btn-outline shrink-0 px-5 py-2.5 rounded-xl text-sm font-medium bg-[var(--card)]/50"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
