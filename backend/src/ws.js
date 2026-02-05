import { WebSocketServer } from "ws";

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch (_) {}
    });
  });
  return wss;
}

function broadcast(wss, payload) {
  if (!wss?.clients) return;
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(str);
  });
}

export function broadcastJobClaimed(wss, jobId, completer) {
  broadcast(wss, { type: "job_claimed", jobId, completer });
}

export function broadcastWorkSubmitted(wss, jobId, completer, ipfsHash) {
  broadcast(wss, { type: "work_submitted", jobId, completer, ipfsHash });
}

export function broadcastJobCompleted(wss, jobId) {
  broadcast(wss, { type: "job_completed", jobId });
}

export function broadcastJobCancelled(wss, jobId, reason) {
  broadcast(wss, { type: "job_cancelled", jobId, reason });
}

export function broadcastJobReopened(wss, jobId) {
  broadcast(wss, { type: "job_reopened", jobId });
}
