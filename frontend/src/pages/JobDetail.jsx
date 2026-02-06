import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJob, escrowJob, claimJob, cancelJob, submitWork, verifyJob, expireJob } from '../api/client';
import { signIssuerAction } from '../api/issuerSign';
import { signCompleterAction } from '../api/completerSign';

function formatBounty(wei, bountyToken = 'MON') {
  if (!wei) return '—';
  const n = BigInt(wei);
  const decimals = bountyToken === 'USDC' ? 6 : 18;
  const val = Number(n) / (10 ** decimals);
  return `${val.toFixed(6)} ${bountyToken}`;
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
    if (!jobId) return;
    setLoading(true);
    setError(null);
    getJob(jobId)
      .then((j) => setJob(j))
      .catch((e) => {
        setError(e.message);
        setJob(null);
      })
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
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      <button onClick={() => navigate('/jobs')} className="text-zinc-400 hover:text-white text-sm mb-6 min-h-[44px] touch-manipulation flex items-center">← Back to jobs</button>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="p-4 sm:p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-zinc-500">#{job.jobId}</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300">{job.status}</span>
          {job.expired && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">Expired</span>
          )}
        </div>
        <h1 className="text-lg sm:text-xl font-bold mb-4 whitespace-pre-wrap break-words">{job.description}</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-500">Bounty</dt>
          <dd>{formatBounty(job.bounty, job.bountyToken)}</dd>
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
            {job.expired && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                <p className="text-sm text-amber-200/90 mb-2">This job is past its deadline. You can expire it to cancel and refund any escrowed bounty.</p>
                <button
                  onClick={() =>
                    runAction('expire', async () => {
                      const sig = await signIssuerAction('expire', job.jobId);
                      return expireJob(job.jobId, sig ? { signature: sig } : {});
                    })
                  }
                  disabled={!!actionLoading}
                  className="px-4 py-2 rounded-lg bg-amber-500/30 border border-amber-500/50 text-amber-200 hover:bg-amber-500/40 disabled:opacity-50"
                >
                  {actionLoading === 'expire' ? 'Expiring…' : 'Expire & refund'}
                </button>
              </div>
            )}
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
              <p className="text-sm text-zinc-400 mb-2">Escrow bounty (backend wallet deposits). Then completer can claim.</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                <button
                  onClick={() =>
                    runAction('escrow', async () => {
                      const sig = await signIssuerAction('escrow', job.jobId);
                      return escrowJob(job.jobId, undefined, sig ? { signature: sig } : {});
                    })
                  }
                  disabled={!!actionLoading}
                  className="px-4 py-3 rounded-lg min-h-[44px] touch-manipulation bg-[var(--accent)] text-black font-medium hover:bg-cyan-300 disabled:opacity-50"
                >
                  {actionLoading === 'escrow' ? 'Escrowing…' : 'Escrow Bounty'}
                </button>
                <button
                  onClick={() =>
                    runAction('cancel', async () => {
                      const sig = await signIssuerAction('cancel', job.jobId);
                      return cancelJob(job.jobId, sig ? { signature: sig } : {});
                    })
                  }
                  disabled={!!actionLoading}
                  className="px-4 py-3 rounded-lg min-h-[44px] touch-manipulation border border-red-400/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel job & refund'}
                </button>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
              <label className="block text-sm text-zinc-400 mb-2">Completer address (your wallet — required to sign)</label>
              <input
                type="text"
                value={completer}
                onChange={(e) => setCompleter(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 rounded bg-[var(--card)] border border-[var(--border)] text-white font-mono text-sm mb-2"
              />
              <button
                onClick={() =>
                  runAction('claim', async () => {
                    const addr = completer.trim();
                    const sig = await signCompleterAction('claim', job.jobId, { completer: addr });
                    return claimJob(job.jobId, addr, sig ? { signature: sig } : {});
                  })
                }
                disabled={!!actionLoading || !completer.trim()}
                className="px-4 py-3 rounded-lg min-h-[44px] touch-manipulation border border-[var(--accent)] text-[var(--accent)] hover:bg-cyan-500/10 disabled:opacity-50"
              >
                {actionLoading === 'claim' ? 'Claiming…' : 'Claim Job'}
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-1.5">You will sign a message to prove you control this address.</p>
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
              onClick={() =>
                runAction('submit', async () => {
                  const hash = ipfsHash.trim();
                  const sig = await signCompleterAction('submit', job.jobId, { completer: job.completer, ipfsHash: hash });
                  return submitWork(job.jobId, { ipfsHash: hash, completer: job.completer, signature: sig ?? undefined });
                })
              }
              disabled={!!actionLoading || !ipfsHash.trim()}
              className="px-4 py-3 rounded-lg min-h-[44px] touch-manipulation bg-[var(--accent)] text-black font-medium hover:bg-cyan-300 disabled:opacity-50"
            >
              {actionLoading === 'submit' ? 'Submitting…' : 'Submit Work'}
            </button>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">Sign from the completer wallet to prove you are submitting this work.</p>
          </div>
        )}
        {job.status === 'submitted' && (
          <div className="p-4 rounded-lg bg-zinc-900/50 border border-[var(--border)]">
            <label className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
              <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
              Approve completion (release bounty to completer)
            </label>
            {approved ? (
              <button
                onClick={() =>
                  runAction('verify', async () => {
                    const sig = await signIssuerAction('verify', job.jobId, { approved: true, reopen: false });
                    return verifyJob(job.jobId, true, sig ? { signature: sig } : {});
                  })
                }
                disabled={!!actionLoading}
                className="w-full sm:w-auto px-4 py-3 rounded-lg min-h-[44px] touch-manipulation font-medium disabled:opacity-50 bg-[var(--success)] text-black hover:opacity-90"
              >
                {actionLoading === 'verify' ? 'Verifying…' : 'Approve & Release'}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <button
                  onClick={() =>
                    runAction('verify', async () => {
                      const sig = await signIssuerAction('verify', job.jobId, { approved: false, reopen: false });
                      return verifyJob(job.jobId, false, { reopen: false, ...(sig ? { signature: sig } : {}) });
                    })
                  }
                  disabled={!!actionLoading}
                  className="w-full sm:w-auto px-4 py-3 rounded-lg min-h-[44px] touch-manipulation font-medium disabled:opacity-50 bg-zinc-600 text-white hover:bg-zinc-500"
                >
                  {actionLoading === 'verify' ? 'Verifying…' : 'Reject & refund issuer'}
                </button>
                <button
                  onClick={() =>
                    runAction('verify', async () => {
                      const sig = await signIssuerAction('verify', job.jobId, { approved: false, reopen: true });
                      return verifyJob(job.jobId, false, { reopen: true, ...(sig ? { signature: sig } : {}) });
                    })
                  }
                  disabled={!!actionLoading}
                  className="w-full sm:w-auto px-4 py-3 rounded-lg min-h-[44px] touch-manipulation font-medium disabled:opacity-50 border border-[var(--accent)] text-[var(--accent)] hover:bg-cyan-500/10"
                >
                  {actionLoading === 'verify' ? 'Verifying…' : 'Reject & reopen for another agent'}
                </button>
              </div>
            )}
          </div>
        )}
        {job.status === 'completed' && (
          <p className="text-zinc-400 text-sm">This job is completed. Bounty has been released.</p>
        )}
        {job.status === 'cancelled' && (
          <p className="text-zinc-400 text-sm">This job was cancelled. Bounty has been refunded to the issuer (if it was escrowed).</p>
        )}
      </div>
    </div>
  );
}
