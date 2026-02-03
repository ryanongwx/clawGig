import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { browseJobs, escrowJob, claimJob, submitWork, verifyJob } from '../api/client';

function formatBounty(wei) {
  if (!wei) return '—';
  const n = BigInt(wei);
  return `${(Number(n) / 1e18).toFixed(6)} MONAD`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [completer, setCompleter] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [approved, setApproved] = useState(true);

  const fetchJob = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      browseJobs({ status: 'open', limit: 200 }),
      browseJobs({ status: 'claimed', limit: 200 }),
      browseJobs({ status: 'submitted', limit: 200 }),
      browseJobs({ status: 'completed', limit: 200 }),
    ])
      .then(([a, b, c, d]) => {
        const all = [...(a.jobs || []), ...(b.jobs || []), ...(c.jobs || []), ...(d.jobs || [])];
        const found = all.find((j) => String(j.jobId) === String(jobId));
        setJob(found || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!jobId) return;
    fetchJob();
  }, [jobId]);

  const runAction = async (name, fn) => {
    setActionLoading(name);
    setError(null);
    try {
      await fn();
      fetchJob();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !job) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-zinc-400">
        Loading job #{jobId}…
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-zinc-400 mb-4">Job #{jobId} not found.</p>
        <button onClick={() => navigate('/jobs')} className="text-[var(--accent)] hover:underline">← Back to jobs</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button onClick={() => navigate('/jobs')} className="text-zinc-400 hover:text-white text-sm mb-6">← Back to jobs</button>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-zinc-500">#{job.jobId}</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">{job.status}</span>
        </div>
        <h1 className="text-xl font-bold mb-4 whitespace-pre-wrap">{job.description}</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-500">Bounty</dt>
          <dd>{formatBounty(job.bounty)}</dd>
          <dt className="text-zinc-500">Deadline</dt>
          <dd>{formatDate(job.deadline)}</dd>
          <dt className="text-zinc-500">Issuer</dt>
          <dd className="font-mono truncate">{job.issuer || '—'}</dd>
          {job.completer && (
            <>
              <dt className="text-zinc-500">Completer</dt>
              <dd className="font-mono truncate">{job.completer}</dd>
            </>
          )}
          {job.ipfsHash && (
            <>
              <dt className="text-zinc-500">IPFS</dt>
              <dd className="font-mono truncate">{job.ipfsHash}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="space-y-4">
        {job.status === 'open' && (
          <>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
              <p className="text-sm text-zinc-400 mb-2">Escrow bounty (backend wallet deposits). Then completer can claim.</p>
              <button
                onClick={() => runAction('escrow', () => escrowJob(job.jobId))}
                disabled={!!actionLoading}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-medium hover:bg-cyan-300 disabled:opacity-50"
              >
                {actionLoading === 'escrow' ? 'Escrowing…' : 'Escrow Bounty'}
              </button>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
              <label className="block text-sm text-zinc-400 mb-2">Completer address</label>
              <input
                type="text"
                value={completer}
                onChange={(e) => setCompleter(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 rounded bg-[var(--card)] border border-[var(--border)] text-white font-mono text-sm mb-2"
              />
              <button
                onClick={() => runAction('claim', () => claimJob(job.jobId, completer.trim()))}
                disabled={!!actionLoading || !completer.trim()}
                className="px-4 py-2 rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {actionLoading === 'claim' ? 'Claiming…' : 'Claim Job'}
              </button>
            </div>
          </>
        )}
        {job.status === 'claimed' && (
          <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
            <label className="block text-sm text-zinc-400 mb-2">IPFS hash of submitted work</label>
            <input
              type="text"
              value={ipfsHash}
              onChange={(e) => setIpfsHash(e.target.value)}
              placeholder="Qm..."
              className="w-full px-3 py-2 rounded bg-[var(--card)] border border-[var(--border)] text-white font-mono text-sm mb-2"
            />
            <button
              onClick={() => runAction('submit', () => submitWork(job.jobId, { ipfsHash: ipfsHash.trim(), completer: job.completer }))}
              disabled={!!actionLoading || !ipfsHash.trim()}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-medium hover:bg-cyan-300 disabled:opacity-50"
            >
              {actionLoading === 'submit' ? 'Submitting…' : 'Submit Work'}
            </button>
          </div>
        )}
        {job.status === 'submitted' && (
          <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
            <label className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
              Approve completion (release bounty to completer)
            </label>
            <button
              onClick={() => runAction('verify', () => verifyJob(job.jobId, approved))}
              disabled={!!actionLoading}
              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 ${approved ? 'bg-[var(--success)] text-black hover:opacity-90' : 'bg-zinc-600 text-white hover:bg-zinc-500'}`}
            >
              {actionLoading === 'verify' ? 'Verifying…' : approved ? 'Approve & Release' : 'Reject (Cancel)'}
            </button>
          </div>
        )}
        {job.status === 'completed' && (
          <p className="text-zinc-400 text-sm">This job is completed. Bounty has been released.</p>
        )}
      </div>
    </div>
  );
}
