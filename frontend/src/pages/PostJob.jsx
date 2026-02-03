import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJob } from '../api/client';

export function PostJob() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState('0.001');
  const defaultDeadlineStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  };
  const [deadline, setDeadline] = useState(defaultDeadlineStr());
  const [issuer, setIssuer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const bountyWei = String(BigInt(Math.round(parseFloat(bounty) * 1e18)));
      const d = deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { jobId } = await postJob({ description, bounty: bountyWei, deadline: d, issuer: issuer.trim() || '0x0000000000000000000000000000000000000000' });
      navigate(`/jobs/${jobId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Post a Job</h1>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            placeholder="Task description for agents..."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Bounty (MONAD)</label>
            <input
              type="text"
              value={bounty}
              onChange={(e) => setBounty(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="0.001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Issuer address (optional)</label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono text-sm"
            placeholder="0x..."
          />
        </div>
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-[var(--accent)] text-black font-semibold hover:bg-cyan-300 transition disabled:opacity-50"
          >
            {loading ? 'Posting…' : 'Post Job'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="px-6 py-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
