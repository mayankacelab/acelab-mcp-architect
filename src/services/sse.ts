import { Response } from 'express';
import { SSEEvent } from '../types';
import { logger } from '../utils/logger';

export class SSEService {
  private connections: Map<string, Response> = new Map();
  private nextConnectionId = 1;

  connect(res: Response): string {
    const connectionId = `sse_${this.nextConnectionId++}`;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection confirmation
    this.sendToConnection(connectionId, {
      event: 'connected',
      data: { connectionId, timestamp: new Date().toISOString() }
    }, res);

    this.connections.set(connectionId, res);

    // Handle connection close
    res.on('close', () => {
      this.disconnect(connectionId);
    });

    // Send periodic heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (this.connections.has(connectionId)) {
        this.sendToConnection(connectionId, {
          event: 'heartbeat',
          data: { timestamp: new Date().toISOString() }
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds

    logger.info(`SSE connection established: ${connectionId}`);
    return connectionId;
  }

  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.end();
      this.connections.delete(connectionId);
      logger.info(`SSE connection closed: ${connectionId}`);
    }
  }

  broadcast(event: SSEEvent): void {
    const deadConnections: string[] = [];

    this.connections.forEach((res, connectionId) => {
      try {
        this.sendToConnection(connectionId, event, res);
      } catch (error) {
        logger.warn(`Failed to send to connection ${connectionId}:`, error);
        deadConnections.push(connectionId);
      }
    });

    // Clean up dead connections
    deadConnections.forEach(connectionId => {
      this.disconnect(connectionId);
    });

    logger.debug(`Broadcast sent to ${this.connections.size} connections`, {
      event: event.event,
      deadConnections: deadConnections.length
    });
  }

  sendToConnection(connectionId: string, event: SSEEvent, res?: Response): void {
    const connection = res || this.connections.get(connectionId);
    if (!connection) {
      logger.warn(`Connection not found: ${connectionId}`);
      return;
    }

    try {
      const sseData = this.formatSSEData(event);
      connection.write(sseData);
      logger.debug(`Event sent to connection ${connectionId}`, { event: event.event });
    } catch (error) {
      logger.error(`Failed to send event to connection ${connectionId}:`, error);
      this.disconnect(connectionId);
    }
  }

  private formatSSEData(event: SSEEvent): string {
    let data = '';

    if (event.id) {
      data += `id: ${event.id}\n`;
    }

    if (event.event) {
      data += `event: ${event.event}\n`;
    }

    if (event.retry) {
      data += `retry: ${event.retry}\n`;
    }

    // Handle multi-line data
    const eventData = typeof event.data === 'string' 
      ? event.data 
      : JSON.stringify(event.data);

    eventData.split('\n').forEach(line => {
      data += `data: ${line}\n`;
    });

    data += '\n'; // Empty line to end the event

    return data;
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}