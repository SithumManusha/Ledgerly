import type { Response, Request } from "express";

interface SSEClient {
  id: string;
  groupId?: number;
  userId?: number;
  res: Response;
}

const clients: Map<string, SSEClient> = new Map();

/**
 * Handles incoming SSE subscriptions at /api/events
 */
export function handleSSESubscription(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = crypto.randomUUID();
  const groupId = req.query.groupId ? parseInt(String(req.query.groupId)) : undefined;
  const userId = req.query.userId ? parseInt(String(req.query.userId)) : undefined;

  clients.set(clientId, { id: clientId, groupId, userId, res });

  // Send initial ping to establish connection
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", clientId })}\n\n`);

  req.on("close", () => {
    clients.delete(clientId);
  });
}

/**
 * Broadcasts an event to all clients listening to a specific group
 */
export function broadcastGroupEvent(groupId: number, eventType: string, payload: unknown) {
  const message = `data: ${JSON.stringify({ type: eventType, groupId, payload, timestamp: new Date().toISOString() })}\n\n`;
  
  for (const client of Array.from(clients.values())) {
    if (!client.groupId || client.groupId === groupId) {
      try {
        client.res.write(message);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

/**
 * Broadcasts an alert or update to a specific user
 */
export function broadcastUserEvent(userId: number, eventType: string, payload: unknown) {
  const message = `data: ${JSON.stringify({ type: eventType, userId, payload, timestamp: new Date().toISOString() })}\n\n`;

  for (const client of Array.from(clients.values())) {
    if (client.userId === userId) {
      try {
        client.res.write(message);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}
