import { Injectable } from '@angular/core';
import { WS_BASE } from './config';

type Listener = (data: any) => void;

/**
 * Thin WebSocket wrapper with auto-reconnect. Unlike the React version,
 * disconnect() cancels the reconnect timer so leaving a page doesn't leak sockets.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Record<string, Listener[]> = {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  connect(path = '/ws'): void {
    this.closed = false;
    this.ws = new WebSocket(`${WS_BASE}${path}`);
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        (this.listeners[data.type || 'message'] ?? []).forEach((fn) => fn(data));
      } catch {
        /* ignore non-JSON frames */
      }
    };
    this.ws.onclose = () => {
      if (!this.closed) {
        this.reconnectTimer = setTimeout(() => this.connect(path), 3000);
      }
    };
  }

  on(event: string, callback: Listener): void {
    (this.listeners[event] ??= []).push(callback);
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data));
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.listeners = {};
    this.ws?.close();
    this.ws = null;
  }
}
