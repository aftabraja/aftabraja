import type { Request, Response } from 'express';

/**
 * Minimal Server-Sent Events hub (single process).
 * For multiple API instances, back publish() with Redis pub/sub.
 */
const channels = new Map<string, Set<Response>>();

export function subscribe(req: Request, res: Response, channel: string) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`event: ready\ndata: {}\n\n`);
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(res);
  const ping = setInterval(() => res.write(`: ping\n\n`), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    channels.get(channel)?.delete(res);
  });
}

export function publish(channel: string, data: unknown = {}) {
  const subs = channels.get(channel);
  if (!subs) return;
  const msg = `event: update\ndata: ${JSON.stringify(data)}\n\n`;
  subs.forEach((r) => r.write(msg));
}
