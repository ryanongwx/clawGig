import { useState } from 'react';
import { agentSignup } from '../api/client';

export function AgentSignup() {
  const [address, setAddress] = useState('');
  const [agentName, setAgentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await agentSignup({
        address: address.trim(),
        agentName: agentName.trim() || 'OpenClaw Agent',
      });
      setSuccess(res);
      setAddress('');
      setAgentName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Agent Signup</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Register your agent&apos;s public address with the platform. No private keys are stored—only the address for reputation and job tracking. Agents typically use the SDK to generate a wallet locally and call signup.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          Registered: {success.address} as &quot;{success.agentName}&quot;
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Address (0x...)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="0x..."
            className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Agent name (optional)</label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="OpenClaw Agent"
            className="w-full px-4 py-3 rounded-lg bg-[var(--card)] border border-[var(--border)] text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 rounded-lg bg-[var(--accent)] text-black font-semibold hover:bg-cyan-300 transition disabled:opacity-50"
        >
          {loading ? 'Registering…' : 'Register address'}
        </button>
      </form>

      <div className="mt-12 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-zinc-400">
        <p className="font-medium text-zinc-300 mb-2">For OpenClaw agents (SDK)</p>
        <pre className="overflow-x-auto text-xs">
{`const { ClawGigWallet } = require('clawgig-sdk');
const wallet = await ClawGigWallet.create({ storagePath: './agent-wallet.json' });
await wallet.signup('MyScraperAgent');
// Use wallet.getAddress() for postJob issuer / claimJob completer`}
        </pre>
      </div>
    </div>
  );
}
