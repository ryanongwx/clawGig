import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getParticipatedJobs } from '../api/client';

const STORAGE_KEY = 'clawgig_my_address';

function formatBounty(wei, bountyToken = 'MON') {
  if (!wei) return '—';
  const n = BigInt(wei);
  const decimals = bountyToken === 'USDC' ? 6 : 18;
  const divisor = 10 ** decimals;
  const val = Number(n) / divisor;
  if (val < 0.0001 && val > 0) return `${val} ${bountyToken}`;
  return `${val >= 1e6 ? val.toLocaleString() : val.toFixed(4)} ${bountyToken}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

const ROLE_OPTIONS = [
  { value: 'both', label: 'All my jobs' },
  { value: 'issuer', label: 'Jobs I posted' },
  { value: 'completer', label: 'Jobs I\'m doing' },
];

export function MyJobs() {
  const [address, setAddress] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [role, setRole] = useState('both');
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async () => {
    const addr = address?.trim();
    if (!addr) {
      setJobs([]);
      setTotal(0);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getParticipatedJobs(addr, { role, limit: 50 });
      setJobs(data.jobs || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.message);
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [address?.trim(), role]);

  useEffect(() => {
    if (address?.trim()) {
      try {
        localStorage.setItem(STORAGE_KEY, address.trim());
      } catch (_) {}
    }
  }, [address]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const needsActionLabel = (job) => {
    if (!job.needsAction) return null;
    if (job.status === 'submitted' && job.issuer) return 'Verify (work submitted)';
    if (job.status === 'rejected_pending_dispute') return 'Rejected — you can dispute';
    if (job.status === 'disputed') return 'Dispute opened';
    return 'Needs action';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">My Jobs</h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">
        View all jobs you posted (issuer) or claimed (completer). You’ll see when work is submitted for your jobs or when your submission was rejected.
      </p>

      <div className="mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Your wallet address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white font-mono text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1.5">Saved in this browser. Use this address to see jobs you issued or completed.</p>
      </div>

      {address?.trim() && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] touch-manipulation ${role === opt.value ? 'btn-primary' : 'btn-outline bg-[var(--card)]/50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-[var(--text-muted)] py-16 text-center">Loading your jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="card-glow py-16 text-center rounded-2xl text-[var(--text-muted)]">
              {address?.trim() ? (
                <>No jobs found for this address with role “{ROLE_OPTIONS.find((o) => o.value === role)?.label}”.</>
              ) : (
                'Enter your address above to see your jobs.'
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                {total} job{total !== 1 ? 's' : ''} — jobs needing your action are highlighted.
              </p>
              <ul className="space-y-4">
                {jobs.map((job) => (
                  <li key={job.jobId} className="card-glow p-4 sm:p-6 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Link to={`/jobs/${job.jobId}`} className="text-[var(--accent)]/80 text-sm font-mono hover:underline">
                            #{job.jobId}
                          </Link>
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-[var(--text-muted)] border border-[var(--border)]">
                            {job.status.replace(/_/g, ' ')}
                          </span>
                          {job.needsAction && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {needsActionLabel(job)}
                            </span>
                          )}
                          {job.expired && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Expired
                            </span>
                          )}
                        </div>
                        <p className="text-white font-medium mb-1 line-clamp-2">{job.description}</p>
                        <p className="text-[var(--text-muted)] text-sm">
                          Bounty: {formatBounty(job.bounty, job.bountyToken)} · Deadline: {formatDate(job.deadline)}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          {job.issuer && <span className="font-mono">Issuer: {job.issuer.slice(0, 10)}… </span>}
                          {job.completer && <span className="font-mono">Completer: {job.completer.slice(0, 10)}…</span>}
                        </p>
                      </div>
                      <Link
                        to={`/jobs/${job.jobId}`}
                        className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] touch-manipulation border border-[var(--accent)] text-[var(--accent)] hover:bg-cyan-500/10 inline-flex items-center justify-center"
                      >
                        View details
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
