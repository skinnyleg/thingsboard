import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string; // 'activation' or model type (e.g., 'AnomalyPredictor', 'ForecastModel')
}

export interface LogDialogData {
  modelId: string;
  modelName: string;
  deviceId: string;
  modelTypeFilter?: string; // 'forecast' or 'anomaly' - filters logs by model type
  websocket?: WebSocket;
  wsUrl?: string;
}

@Component({
  selector: 'tb-model-logs-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './model-logs-dialog.component.html',
  styleUrls: ['./model-logs-dialog.component.scss'],
})
export class ModelLogsDialogComponent implements OnInit, OnDestroy {
  logs: LogEntry[] = [];

  filteredLogs: LogEntry[] = [];

  selectedLevel = 'all';

  autoScroll = true;

  isLoading = true;

  isRefreshing = false;

  isConnected = false;

  private refreshSubscription?: Subscription;

  private MAX_LOGS = 500; // Limit log entries to prevent memory issues

  constructor(
    public dialogRef: MatDialogRef<ModelLogsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LogDialogData
  ) {}

  ngOnInit(): void {
    // Initial log load
    this.loadLogs();

    // Set up auto-refresh every 5 seconds
    this.refreshSubscription = interval(5000).subscribe(() => {
      if (!this.isRefreshing) {
        this.refreshLogs(true);
      }
    });

    // Simulate connection status (replace with actual WebSocket status)
    this.isConnected = true;
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private commandId = 1;

  private ws: WebSocket | null = null;

  loadLogs(): void {
    this.isLoading = true;

    // Use provided WebSocket or create new one
    if (
      this.data.websocket &&
      this.data.websocket.readyState === WebSocket.OPEN
    ) {
      this.ws = this.data.websocket;
      this.setupWebSocketHandlers();
      this.requestLogs();
    } else if (this.data.wsUrl) {
      this.ws = new WebSocket(this.data.wsUrl);
      this.ws.onopen = () => {
        this.isConnected = true;
        this.requestLogs();
      };
      this.setupWebSocketHandlers();
    } else {
      // Fallback to mock logs if no WebSocket
      // this.logs = this.generateMockLogs();
      this.filterLogs();
      this.isLoading = false;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) {return;}

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'response' && msg.data && msg.data.logs) {
          // Historical logs response (already sorted DESC from backend)
          this.logs = msg.data.logs.map((log: any) => ({
            timestamp: log.timestamp,
            level: log.level || 'INFO',
            message: log.message,
            source: log.source,
          }));
          this.filterLogs();
          this.isLoading = false;
          // Scroll to top for descending order (newest first)
          setTimeout(() => this.scrollToTop(), 100);
        } else if (msg.type === 'logs') {
          // Real-time log updates - add to beginning (newest first)
          const newLogs = msg.data.logs.map((log: any) => ({
            timestamp: log.timestamp,
            level: log.level || 'INFO',
            message: log.message,
            source: log.source,
          }));
          // Prepend new logs (newest at top) and limit total
          this.logs = [...newLogs, ...this.logs].slice(0, this.MAX_LOGS);
          this.filterLogs();
          // Keep scroll at top for new logs
          setTimeout(() => this.scrollToTop(), 100);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    this.ws.onerror = () => {
      this.isConnected = false;
    };

    this.ws.onclose = () => {
      this.isConnected = false;
    };
  }

  private requestLogs(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {return;}

    // Use subscribe_logs to get 7 days of historical logs + real-time updates
    const msg = {
      commandId: this.commandId++,
      type: 'subscribe_logs',
      forecastId: this.data.modelId,
      data: {
        limit: 1000, // Get up to 1000 logs from past 7 days
      },
    };

    this.ws.send(JSON.stringify(msg));
    console.log('Subscribed to logs (historical + real-time):', msg);
  }

  refreshLogs(silent: boolean = false): void {
    if (!silent) {
      this.isRefreshing = true;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.requestLogs();
      setTimeout(() => {
        this.isRefreshing = false;
      }, 300);
    } else {
      // Fallback
    }
  }

  onLevelChange(event: any): void {
    this.selectedLevel = event.value;
    this.filterLogs();
  }

  filterLogs(): void {
    let filtered = [...this.logs];

    // Filter by model type if specified
    if (this.data.modelTypeFilter) {
      filtered = filtered.filter((log) => {
        if (!log.source || log.source === 'activation') {
          return true; // Always show activation logs
        }
        // Check if log source matches the model type filter
        if (this.data.modelTypeFilter === 'forecast') {
          return log.source.toLowerCase().includes('forecast');
        } else if (this.data.modelTypeFilter === 'anomaly') {
          return log.source.toLowerCase().includes('anomaly');
        }
        return true;
      });
    }

    // Filter by log level
    if (this.selectedLevel === 'all') {
      this.filteredLogs = filtered;
    } else {
      this.filteredLogs = filtered.filter(
        (log) => log.level.toLowerCase() === this.selectedLevel
      );
    }
  }

  clearLogs(): void {
    this.logs = [];
    this.filteredLogs = [];
  }

  toggleAutoScroll(): void {
    this.autoScroll = !this.autoScroll;
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  getLogCount(level: string): number {
    if (level === 'all') {
      return this.logs.length;
    }
    return this.logs.filter((log) => log.level === level).length;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  getLevelIcon(level: string): string {
    switch (level) {
      case 'INFO':
        return 'info';
      case 'WARN':
        return 'warning';
      case 'ERROR':
        return 'error';
      default:
        return 'description';
    }
  }

  getSourceIcon(source?: string): string {
    if (!source) {return 'code';}
    if (source === 'activation') {return 'play_circle';}
    if (source.includes('Anomaly')) {return 'bug_report';}
    if (source.includes('Forecast')) {return 'trending_up';}
    return 'psychology';
  }

  getSourceTooltip(source?: string): string {
    if (!source) {return 'Unknown source';}
    if (source === 'activation') {return 'Model Activation';}
    return `${source} Job`;
  }

  getModelTypeIcon(): string {
    if (this.data.modelTypeFilter === 'forecast') {
      return 'trending_up';
    } else if (this.data.modelTypeFilter === 'anomaly') {
      return 'bug_report';
    }
    return 'description';
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.logs-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  scrollToTop(): void {
    setTimeout(() => {
      const container = document.querySelector('.logs-container');
      if (container) {
        container.scrollTop = 0;
      }
    }, 100);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  // Mock data generator (remove in production)
  private generateMockLogs(count: number = 20): LogEntry[] {
    const levels = ['INFO', 'WARN', 'ERROR'];
    const sources = ['activation', 'AnomalyPredictor', 'ForecastModel', null];
    const messages = [
      'Model training started',
      'Loading model from disk',
      'Prediction completed successfully',
      'Database connection established',
      'Sensor data fetched: 1000 points',
      'Anomaly detected with 85% probability',
      'Forecast generated for next 24 hours',
      'Job iteration completed',
      'Warning: Sensor data missing for sensor_23',
      'Error: Database connection timeout',
      'Model saved to /models/abc-123/',
      'Job started: AnomalyPredictor',
      'Fetching latest telemetry data',
      'Computing prediction features',
      'Model accuracy: 0.92',
    ];

    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - (count - i) * 30000).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      source: sources[Math.floor(Math.random() * sources.length)] || undefined,
    }));
  }
}
