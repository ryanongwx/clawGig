import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { browseJobs, expireJob } from '../api/client';

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

const PAGE_SIZE = 20;

export function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [bountyToken, setBountyToken] = useState('');
  const [issuer, setIssuer] = useState('');
  const [includeExpired, setIncludeExpired] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const searchDebounceRef = useRef(true);

  const fetchPage = useCallback(async (off = 0, append = false) => {
    if (off === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await browseJobs({
        status,
        limit: PAGE_SIZE,
        offset: off,
        q: q.trim() || undefined,
        bountyToken: bountyToken || undefined,
        issuer: issuer.trim() || undefined,
        includeExpired: status === 'open' ? includeExpired : undefined,
      });
      if (append) {
        setJobs((prev) => [...prev, ...(data.jobs || [])]);
      } else {
        setJobs(data.jobs || []);
      }
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
      setOffset(off + (data.jobs?.length ?? 0));
    } catch (e) {
      setError(e.message);
      if (!append) setJobs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [status, q, bountyToken, issuer, includeExpired]);

  useEffect(() => {
    setOffset(0);
    fetchPage(0, false);
  }, [status, bountyToken, includeExpired]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      searchDebounceRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      setOffset(0);
      fetchPage(0, false);
    }, 400);
    return () => clearTimeout(t);
  }, [q, issuer]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchPage(offset, true);
  };

  const handleExpire = async (jobId) => {
    setActionLoading(jobId);
    setError(null);
    try {
      await expireJob(jobId);
      setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, status: 'cancelled', expired: false } : j)));
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 md:py-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Browse Jobs</h1>
        <Link to="/post" className="btn-primary px-5 py-3 rounded-xl text-sm font-semibold w-full sm:w-auto text-center min-h-[44px] flex items-center justify-center touch-manipulation">
          Post Job
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
        {['open', 'claimed', 'submitted', 'completed', 'rejected_pending_dispute', 'disputed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] touch-manipulation ${status === s ? 'btn-primary' : 'btn-outline bg-[var(--card)]/50'}`}
          >
            {s === 'rejected_pending_dispute' ? 'Rejected' : s === 'disputed' ? 'Disputed' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <p className="text-sm font-medium text-[var(--text-muted)] mb-3">Search & filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <select
            value={bountyToken}
            onChange={(e) => setBountyToken(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">All tokens</option>
            <option value="MON">MON</option>
            <option value="USDC">USDC</option>
          </select>
          <input
            type="text"
            placeholder="Issuer address…"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-white placeholder-zinc-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {status === 'open' && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
              />
              Include expired
            </label>
          )}
        </div>
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
          No {status} jobs match. <Link to="/post" className="text-[var(--accent)] hover:underline font-medium">Post one</Link>.
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Showing {jobs.length} of {total} job{total !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.jobId} className="card-glow p-4 sm:p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[var(--accent)]/80 text-sm font-mono">#{job.jobId}</span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 text-[var(--text-muted)] border border-[var(--border)]">{job.status}</span>
                      {job.expired && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Expired</span>
                      )}
                    </div>
                    <p className="text-white font-medium mb-1 line-clamp-2">{job.description}</p>
                    <p className="text-[var(--text-muted)] text-sm">
                      Bounty: {formatBounty(job.bounty, job.bountyToken)} · Deadline: {formatDate(job.deadline)}
                    </p>
                    {job.issuer && <p className="text-zinc-500 text-xs mt-1 font-mono">Issuer: {job.issuer.slice(0, 10)}…</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {job.status === 'open' && job.expired && (
                      <button
                        onClick={() => handleExpire(job.jobId)}
                        disabled={!!actionLoading}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] touch-manipulation border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                      >
                        {actionLoading === job.jobId ? 'Expiring…' : 'Expire & refund'}
                      </button>
                    )}
                    <Link
                      to={`/jobs/${job.jobId}`}
                      className="btn-outline px-5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center justify-center bg-[var(--card)]/50 touch-manipulation"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-outline px-6 py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
