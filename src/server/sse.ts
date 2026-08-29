import { Response } from 'express';

// Set to hold all active SSE connections from browser clients
const sseClients = new Set<Response>();

/**
 * Register a new SSE client connection
 */
export function addSseClient(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to NSPC Real-time Stream', timestamp: Date.now() })}\n\n`);

  sseClients.add(res);

  res.on('close', () => {
    sseClients.delete(res);
  });
}

/**
 * Broadcast an event to all connected SSE clients in real-time
 */
export function broadcastRealtimeEvent(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify({ event: eventType, data, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Keep-alive heartbeat interval (every 15 seconds)
setInterval(() => {
  const heartbeat = `: heartbeat ${Date.now()}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(heartbeat);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 15000);
