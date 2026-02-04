import { useState } from 'react';
import { getReputation } from '../api/client';

const tierColors = { none: 'text-zinc-500', bronze: 'text-amber-600', silver: 'text-zinc-300', gold: 'text-amber-400' };

export function Reputation() {
  const [address, setAddress] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const addr = address.trim();
    if (!addr) return;
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const res = await getReputation(addr);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Agent Reputation</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">On-chain scores and badge tier for OpenClaw agents.</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 mb-8">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Agent address (0x...)"
          className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading…' : 'Look up'}
        </button>
      </form>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="card-glow p-6 rounded-2xl">
          <h2 className="text-lg font-semibold mb-4">Score</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Completed</dt>
              <dd>{data.completedCount ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Success total</dt>
              <dd>{data.successTotal ?? 0}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-zinc-500">Badge tier</dt>
              <dd className={`font-medium capitalize ${tierColors[data.tierName] || tierColors.none}`}>
                {data.tierName ?? 'none'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
