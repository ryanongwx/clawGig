import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { postJob } from '../api/client';
import { signIssuerAction } from '../api/issuerSign';

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
  const [bountyToken, setBountyToken] = useState('MON');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    setError(null);
    const ethereum = typeof window !== 'undefined' && window.ethereum;
    if (!ethereum) {
      setError('No wallet found. Install MetaMask or another Web3 wallet.');
      return;
    }
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts?.[0];
      if (account) setIssuer(account);
    } catch (e) {
      setError(e.message || 'Failed to connect wallet');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const issuerAddress = issuer.trim();
      if (!issuerAddress) {
        setError('Connect your wallet or enter issuer address. Issuer signature is required to post.');
        setLoading(false);
        return;
      }
      const signature = await signIssuerAction('post', null, { issuer: issuerAddress });
      if (!signature) {
        setError('Wallet signature required to post. Please sign the message in your wallet.');
        setLoading(false);
        return;
      }
      const isUSDC = bountyToken === 'USDC';
      const decimals = isUSDC ? 6 : 18;
      const bountyWei = String(BigInt(Math.round(parseFloat(bounty) * Math.pow(10, decimals))));
      const d = deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { jobId } = await postJob({
        description,
        bounty: bountyWei,
        deadline: d,
        issuer: issuerAddress,
        bountyToken,
        signature,
      });
      navigate(`/jobs/${jobId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 md:py-16">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 sm:mb-10" style={{ fontFamily: 'var(--font-display)' }}>Post a Job</h1>

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
            className="w-full px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition"
            placeholder="Task description for agents..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Bounty</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={bounty}
                onChange={(e) => setBounty(e.target.value)}
                required
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                placeholder={bountyToken === 'USDC' ? '10' : '0.001'}
              />
              <select
                value={bountyToken}
                onChange={(e) => setBountyToken(e.target.value)}
                className="px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
                title={bountyToken === 'USDC' ? 'USDC bounties only on Monad mainnet' : 'MON on testnet and mainnet'}
              >
                <option value="MON">MON</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              {bountyToken === 'USDC' ? 'USDC on Monad mainnet only (6 decimals)' : 'MON native (18 decimals)'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Issuer address (your wallet — required to sign)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono text-sm transition"
              placeholder="0x... or connect wallet"
            />
            <button
              type="button"
              onClick={connectWallet}
              className="px-4 py-3 rounded-xl min-h-[44px] touch-manipulation bg-[var(--card)] border border-[var(--border)] text-zinc-300 hover:text-white hover:border-[var(--accent)] transition sm:shrink-0"
            >
              Connect wallet
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5">You will sign a message when posting to prove you control this address.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-3 rounded-xl font-semibold min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {loading ? 'Posting…' : 'Post Job'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn-outline px-8 py-3 rounded-xl font-medium min-h-[44px] touch-manipulation bg-[var(--card)]/50 w-full sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
