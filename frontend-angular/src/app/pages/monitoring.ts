import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { WebSocketService } from '../core/websocket.service';

interface Metrics {
  tasks_completed?: number;
  tasks_failed?: number;
  tools_called?: number;
  avg_execution_time?: number;
}

@Component({
  selector: 'app-monitoring-page',
  template: `
    <h1>Monitoring</h1>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 24px">
      <div class="card"><h3>Completed</h3><p>{{ metrics()?.tasks_completed || 0 }}</p></div>
      <div class="card"><h3>Failed</h3><p>{{ metrics()?.tasks_failed || 0 }}</p></div>
      <div class="card"><h3>Tools Called</h3><p>{{ metrics()?.tools_called || 0 }}</p></div>
      <div class="card"><h3>Avg Time</h3><p>{{ metrics()?.avg_execution_time || 0 }}s</p></div>
    </div>
  `,
})
export class MonitoringPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WebSocketService);
  protected readonly metrics = signal<Metrics | null>(null);

  ngOnInit() {
    this.api.get<Metrics>('/monitoring/metrics').then((m) => this.metrics.set(m)).catch(console.error);
    this.ws.connect('/ws/monitoring');
    this.ws.on('metrics', (data) => this.metrics.set(data));
  }

  ngOnDestroy() {
    this.ws.disconnect();
  }
}
