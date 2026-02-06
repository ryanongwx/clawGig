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

export async function postJob({ description, bounty, deadline, issuer, bountyToken, signature }) {
  const d = typeof deadline === 'number' ? new Date(deadline * 1000).toISOString() : deadline;
  const body = { description, bounty: String(bounty), deadline: d, issuer };
  if (bountyToken) body.bountyToken = bountyToken;
  if (signature) body.signature = signature;
  return request('POST', '/jobs/post', body);
}

export async function getStats() {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/jobs/stats`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function browseJobs({
  status = 'open',
  limit = 20,
  offset = 0,
  q,
  minBounty,
  maxBounty,
  bountyToken,
  issuer,
  deadlineBefore,
  deadlineAfter,
  includeExpired,
} = {}) {
  const params = new URLSearchParams({ status, limit: String(limit), offset: String(offset) });
  if (q != null && q !== '') params.set('q', q);
  if (minBounty != null && minBounty !== '') params.set('minBounty', String(minBounty));
  if (maxBounty != null && maxBounty !== '') params.set('maxBounty', String(maxBounty));
  if (bountyToken != null && bountyToken !== '') params.set('bountyToken', bountyToken);
  if (issuer != null && issuer !== '') params.set('issuer', issuer);
  if (deadlineBefore != null && deadlineBefore !== '') params.set('deadlineBefore', deadlineBefore);
  if (deadlineAfter != null && deadlineAfter !== '') params.set('deadlineAfter', deadlineAfter);
  if (includeExpired === false) params.set('includeExpired', 'false');
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/jobs/browse?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function expireJob(jobId, opts = {}) {
  const body = {};
  if (opts.signature) body.signature = opts.signature;
  return request('POST', `/jobs/${jobId}/expire`, Object.keys(body).length ? body : {});
}

export async function getJob(jobId) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/jobs/${jobId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function cancelJob(jobId, opts = {}) {
  const body = {};
  if (opts.signature) body.signature = opts.signature;
  return request('POST', `/jobs/${jobId}/cancel`, Object.keys(body).length ? body : {});
}

export async function escrowJob(jobId, bountyWei, opts = {}) {
  const body = {};
  if (bountyWei != null) body.bountyWei = String(bountyWei);
  if (opts.signature) body.signature = opts.signature;
  return request('POST', `/jobs/${jobId}/escrow`, Object.keys(body).length ? body : {});
}

export async function claimJob(jobId, completer, opts = {}) {
  const body = { completer };
  if (opts.signature) body.signature = opts.signature;
  return request('POST', `/jobs/${jobId}/claim`, body);
}

export async function submitWork(jobId, { ipfsHash, completer, signature }) {
  const body = { ipfsHash, completer };
  if (signature) body.signature = signature;
  return request('POST', `/jobs/${jobId}/submit`, body);
}

export async function verifyJob(jobId, approved, opts = {}) {
  const body = { approved };
  if (opts.reopen != null) body.reopen = opts.reopen;
  if (opts.split != null) body.split = opts.split;
  if (opts.signature) body.signature = opts.signature;
  return request('POST', `/jobs/${jobId}/verify`, body);
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
