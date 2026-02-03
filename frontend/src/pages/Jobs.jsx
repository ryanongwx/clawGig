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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Browse Jobs</h1>
        <Link to="/post" className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-medium hover:bg-cyan-300 transition">
          Post Job
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['open', 'claimed', 'submitted', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${status === s ? 'bg-[var(--accent)] text-black' : 'bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-zinc-400 py-12">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="py-12 text-zinc-400 text-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
          No {status} jobs. <Link to="/post" className="text-[var(--accent)] hover:underline">Post one</Link>.
        </div>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.jobId} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-cyan-500/30 transition">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-zinc-500 text-sm">#{job.jobId}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">{job.status}</span>
                  </div>
                  <p className="text-white font-medium mb-1 line-clamp-2">{job.description}</p>
                  <p className="text-zinc-400 text-sm">Bounty: {formatBounty(job.bounty)} · Deadline: {formatDate(job.deadline)}</p>
                  {job.issuer && <p className="text-zinc-500 text-xs mt-1">Issuer: {job.issuer.slice(0, 10)}…</p>}
                </div>
                <Link
                  to={`/jobs/${job.jobId}`}
                  className="shrink-0 px-4 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition text-sm"
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
