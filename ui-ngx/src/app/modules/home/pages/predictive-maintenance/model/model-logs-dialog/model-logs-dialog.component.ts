import { Component, Inject, OnInit, OnDestroy } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from "@angular/material/dialog";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { Subscription, interval } from "rxjs";

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
  selector: "tb-model-logs-dialog",
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
  template: `
    <div class="logs-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <mat-icon class="header-icon">description</mat-icon>
          <h2 mat-dialog-title>Model Logs</h2>
        </div>
        <button mat-icon-button (click)="onClose()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-subtitle">
        <span class="model-name">{{ data.modelName }}</span>
        <span class="separator">•</span>
        <span class="model-id">{{ data.modelId }}</span>
        <span class="separator" *ngIf="data.modelTypeFilter">•</span>
        <span class="model-type" *ngIf="data.modelTypeFilter">
          <mat-icon class="type-icon">{{ getModelTypeIcon() }}</mat-icon>
          {{ data.modelTypeFilter | titlecase }} Logs
        </span>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- Filter Chips -->
        <div class="filter-section">
          <mat-chip-listbox
            [value]="selectedLevel"
            (change)="onLevelChange($event)"
          >
            <mat-chip-option value="all" [selected]="selectedLevel === 'all'">
              <mat-icon>filter_list</mat-icon>
              All ({{ getLogCount("all") }})
            </mat-chip-option>
            <mat-chip-option value="info" [selected]="selectedLevel === 'info'">
              <mat-icon class="level-icon info">info</mat-icon>
              Info ({{ getLogCount("INFO") }})
            </mat-chip-option>
            <mat-chip-option value="warn" [selected]="selectedLevel === 'warn'">
              <mat-icon class="level-icon warn">warning</mat-icon>
              Warn ({{ getLogCount("WARN") }})
            </mat-chip-option>
            <mat-chip-option
              value="error"
              [selected]="selectedLevel === 'error'"
            >
              <mat-icon class="level-icon error">error</mat-icon>
              Error ({{ getLogCount("ERROR") }})
            </mat-chip-option>
          </mat-chip-listbox>

          <div class="actions">
            <button
              mat-icon-button
              (click)="toggleAutoScroll()"
              [matTooltip]="
                autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'
              "
            >
              <mat-icon [class.active]="autoScroll">{{
                autoScroll ? "lock" : "lock_open"
              }}</mat-icon>
            </button>
            <button
              mat-icon-button
              (click)="refreshLogs()"
              matTooltip="Refresh Logs"
            >
              <mat-icon [class.spinning]="isRefreshing">refresh</mat-icon>
            </button>
            <button
              mat-icon-button
              (click)="clearLogs()"
              matTooltip="Clear Logs"
            >
              <mat-icon>delete_sweep</mat-icon>
            </button>
          </div>
        </div>

        <!-- Loading Spinner -->
        <div class="loading-container" *ngIf="isLoading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading logs...</p>
        </div>

        <!-- Terminal-style Logs Container -->
        <div class="logs-terminal" #logsContainer *ngIf="!isLoading">
          <div *ngIf="filteredLogs.length === 0" class="no-logs">
            <mat-icon>inbox</mat-icon>
            <p>No logs available</p>
            <small>Logs will appear here once the model is activated</small>
          </div>

          <div class="log-row" *ngFor="let log of filteredLogs">
            <div class="log-labels">
              <span class="log-time">{{ formatTimestamp(log.timestamp) }}</span>
              <span class="log-level" [ngClass]="log.level.toLowerCase()">{{
                log.level
              }}</span>
              <span class="log-source" *ngIf="log.source">{{
                log.source
              }}</span>
            </div>
            <div class="log-message">{{ log.message }}</div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-actions">
        <div class="status-info">
          <mat-icon class="status-icon" [class.connected]="isConnected">
            {{ isConnected ? "cloud_done" : "cloud_off" }}
          </mat-icon>
          <span class="status-text">
            {{ isConnected ? "Connected" : "Disconnected" }}
          </span>
          <span class="log-count">• {{ filteredLogs.length }} logs</span>
        </div>
        <button mat-raised-button color="primary" (click)="onClose()">
          Close
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .logs-dialog {
        .logs-terminal {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          background: #181c20;
          font-family: 'Roboto Mono', 'monospace', monospace;
          color: #e0e0e0;
          font-size: 13px;
          border-radius: 6px;
          box-shadow: 0 0 0 1px #23272b;
        }

        :host-context(.tb-dark) .logs-terminal {
          background: #101215;
          color: #e0e0e0;
          box-shadow: 0 0 0 1px #23272b;
        }

        .log-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          border-bottom: 1px solid #23272b;
          padding: 0 0 0 0;
          min-height: 24px;
        }

        .log-labels {
          display: flex;
          flex-direction: row;
          align-items: center;
          min-width: 260px;
          max-width: 320px;
          flex-shrink: 0;
          padding: 0 12px 0 16px;
          gap: 8px;
          white-space: nowrap;
        }

        .log-time {
          color: #8fa1b3;
          font-size: 12px;
          width: 70px;
          text-align: left;
        }

        .log-level {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          background: #23272b;
          color: #e0e0e0;
          width: 48px;
          text-align: center;
        }
        .log-level.info { color: #2196f3; background: #23272b; }
        .log-level.warn { color: #ff9800; background: #23272b; }
        .log-level.error { color: #f44336; background: #23272b; }

        .log-source {
          color: #7ec699;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 3px;
          background: #23272b;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .log-message {
          flex: 1;
          padding: 4px 8px 4px 0;
          font-size: 13px;
          color: #e0e0e0;
          word-break: break-word;
          white-space: pre-line;
        }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .spinning {
        animation: spin 1s linear infinite;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        gap: 16px;
      }

      .logs-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px 24px;
        background: #fafafa;
      }

      :host-context(.tb-dark) .logs-container {
        background: #121212;
      }

      .no-logs {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: rgba(0, 0, 0, 0.38);
      }

      :host-context(.tb-dark) .no-logs {
        color: rgba(255, 255, 255, 0.5);
      }

      .no-logs mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.3;
      }

      .log-entry {
        background: white;
        border-left: 4px solid #e0e0e0;
        border-radius: 4px;
        padding: 12px 16px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.2s;
      }

      :host-context(.tb-dark) .log-entry {
        background: #1e1e1e;
        border-left: 4px solid #424242;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .log-entry:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transform: translateX(2px);
      }

      :host-context(.tb-dark) .log-entry:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      }

      .log-entry.info {
        border-left-color: #2196f3;
      }

      .log-entry.warn {
        border-left-color: #ff9800;
      }

      .log-entry.error {
        border-left-color: #f44336;
      }

      .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .log-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
      }

      .level-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
      }

      .level-icon.info {
        color: #2196f3;
      }

      .level-icon.warn {
        color: #ff9800;
      }

      .level-icon.error {
        color: #f44336;
      }

      .log-level {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.05);
      }

      :host-context(.tb-dark) .log-level {
        background: rgba(255, 255, 255, 0.1);
      }

      .log-time {
        color: rgba(0, 0, 0, 0.6);
        font-family: "Roboto Mono", monospace;
        font-size: 11px;
      }

      :host-context(.tb-dark) .log-time {
        color: rgba(255, 255, 255, 0.6);
      }

      .log-source {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: rgba(25, 118, 210, 0.08);
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        color: #1976d2;
      }

      .source-icon {
        width: 14px;
        height: 14px;
        font-size: 14px;
      }

      .log-message {
        font-size: 14px;
        line-height: 1.5;
        color: rgba(0, 0, 0, 0.87);
        word-wrap: break-word;
      }

      :host-context(.tb-dark) .log-message {
        color: rgba(255, 255, 255, 0.87);
      }

      .dialog-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
      }

      :host-context(.tb-dark) .dialog-actions {
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }

      .status-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(0, 0, 0, 0.6);
      }

      :host-context(.tb-dark) .status-info {
        color: rgba(255, 255, 255, 0.7);
      }

      .status-icon {
        width: 20px;
        height: 20px;
        font-size: 20px;
      }

      .status-icon.connected {
        color: #4caf50;
      }

      .log-count {
        color: rgba(0, 0, 0, 0.38);
      }

      :host-context(.tb-dark) .log-count {
        color: rgba(255, 255, 255, 0.5);
      }
      }
    `,
  ],
})
export class ModelLogsDialogComponent implements OnInit, OnDestroy {
  logs: LogEntry[] = [];
  filteredLogs: LogEntry[] = [];
  selectedLevel: string = "all";
  autoScroll: boolean = true;
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  isConnected: boolean = false;

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
      this.logs = this.generateMockLogs();
      this.filterLogs();
      this.isLoading = false;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "response" && msg.data && msg.data.logs) {
          // Historical logs response (already sorted DESC from backend)
          this.logs = msg.data.logs.map((log: any) => ({
            timestamp: log.timestamp,
            level: log.level || "INFO",
            message: log.message,
            source: log.source,
          }));
          this.filterLogs();
          this.isLoading = false;
          // Scroll to top for descending order (newest first)
          setTimeout(() => this.scrollToTop(), 100);
        } else if (msg.type === "logs") {
          // Real-time log updates - add to beginning (newest first)
          const newLogs = msg.data.logs.map((log: any) => ({
            timestamp: log.timestamp,
            level: log.level || "INFO",
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
        console.error("Error parsing WebSocket message:", e);
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Use subscribe_logs to get 7 days of historical logs + real-time updates
    const msg = {
      commandId: this.commandId++,
      type: "subscribe_logs",
      forecastId: this.data.modelId,
      data: {
        limit: 1000, // Get up to 1000 logs from past 7 days
      },
    };

    this.ws.send(JSON.stringify(msg));
    console.log("Subscribed to logs (historical + real-time):", msg);
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
      setTimeout(() => {
        const newLogs = this.generateMockLogs(3);
        this.logs = [...this.logs, ...newLogs].slice(-this.MAX_LOGS);
        this.filterLogs();
        this.isRefreshing = false;

        if (this.autoScroll) {
          this.scrollToBottom();
        }
      }, 300);
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
        if (!log.source || log.source === "activation") {
          return true; // Always show activation logs
        }
        // Check if log source matches the model type filter
        if (this.data.modelTypeFilter === "forecast") {
          return log.source.toLowerCase().includes("forecast");
        } else if (this.data.modelTypeFilter === "anomaly") {
          return log.source.toLowerCase().includes("anomaly");
        }
        return true;
      });
    }

    // Filter by log level
    if (this.selectedLevel === "all") {
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
    if (level === "all") {
      return this.logs.length;
    }
    return this.logs.filter((log) => log.level === level).length;
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  getLevelIcon(level: string): string {
    switch (level) {
      case "INFO":
        return "info";
      case "WARN":
        return "warning";
      case "ERROR":
        return "error";
      default:
        return "description";
    }
  }

  getSourceIcon(source?: string): string {
    if (!source) return "code";
    if (source === "activation") return "play_circle";
    if (source.includes("Anomaly")) return "bug_report";
    if (source.includes("Forecast")) return "trending_up";
    return "psychology";
  }

  getSourceTooltip(source?: string): string {
    if (!source) return "Unknown source";
    if (source === "activation") return "Model Activation";
    return `${source} Job`;
  }

  getModelTypeIcon(): string {
    if (this.data.modelTypeFilter === "forecast") {
      return "trending_up";
    } else if (this.data.modelTypeFilter === "anomaly") {
      return "bug_report";
    }
    return "description";
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector(".logs-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  scrollToTop(): void {
    setTimeout(() => {
      const container = document.querySelector(".logs-container");
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
    const levels = ["INFO", "WARN", "ERROR"];
    const sources = ["activation", "AnomalyPredictor", "ForecastModel", null];
    const messages = [
      "Model training started",
      "Loading model from disk",
      "Prediction completed successfully",
      "Database connection established",
      "Sensor data fetched: 1000 points",
      "Anomaly detected with 85% probability",
      "Forecast generated for next 24 hours",
      "Job iteration completed",
      "Warning: Sensor data missing for sensor_23",
      "Error: Database connection timeout",
      "Model saved to /models/abc-123/",
      "Job started: AnomalyPredictor",
      "Fetching latest telemetry data",
      "Computing prediction features",
      "Model accuracy: 0.92",
    ];

    return Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() - (count - i) * 30000).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      source: sources[Math.floor(Math.random() * sources.length)] || undefined,
    }));
  }
}
