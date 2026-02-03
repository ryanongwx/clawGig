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

export function broadcastJobClaimed(wss, jobId, completer) {
  if (!wss?.clients) return;
  const payload = JSON.stringify({ type: "job_claimed", jobId, completer });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(payload);
  });
}
