const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

async function request(method, path, body = null) {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export async function postJob({ description, bounty, deadline, issuer }) {
  const d = typeof deadline === 'number' ? new Date(deadline * 1000).toISOString() : deadline;
  return request('POST', '/jobs/post', { description, bounty: String(bounty), deadline: d, issuer });
}

export async function browseJobs({ status = 'open', limit = 20 } = {}) {
  const params = new URLSearchParams({ status, limit: String(limit) });
  const res = await fetch(`${baseUrl}/jobs/browse?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function escrowJob(jobId, bountyWei) {
  return request('POST', `/jobs/${jobId}/escrow`, bountyWei != null ? { bountyWei: String(bountyWei) } : {});
}

export async function claimJob(jobId, completer) {
  return request('POST', `/jobs/${jobId}/claim`, { completer });
}

export async function submitWork(jobId, { ipfsHash, completer }) {
  return request('POST', `/jobs/${jobId}/submit`, { ipfsHash, completer });
}

export async function verifyJob(jobId, approved) {
  return request('POST', `/jobs/${jobId}/verify`, { approved });
}

export async function getReputation(address) {
  const res = await fetch(`${baseUrl}/reputation/${encodeURIComponent(address)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/** Register agent address with platform (non-custodial: no keys stored). */
export async function agentSignup({ address, agentName }) {
  return request('POST', '/agents/signup', { address, agentName });
}
