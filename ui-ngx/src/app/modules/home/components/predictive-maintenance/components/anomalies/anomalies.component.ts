///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import {
  ConnectedPosition,
  Overlay,
  OverlayConfig,
  OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { StaticProvider } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import {
  DISPLAY_COLUMNS_PANEL_DATA,
  DisplayColumnsPanelComponent,
  DisplayColumnsPanelData,
} from '@home/components/widget/lib/display-columns-panel.component';
import { DisplayColumn } from '@home/components/widget/lib/table-widget.models';
import { DEFAULT_OVERLAY_POSITIONS } from '@shared/models/overlay.models';
import { WidgetComponentsModule } from '@home/components/widget/widget-components.module';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  ModelWebSocketService,
  AnomalyStreamMessage,
  AnomalyStreamSubscription,
} from '@app/core/http/model-websocket.service';

export interface AnomalyReport {
  id: string;
  reportEntity: string;
  errorName: string;
  severity: 'Critical' | 'Major' | 'Minor';
  creationDate: string;
  componentType: string;
  deviceType: string;
  location: string;
  description: string;
  status: 'Active' | 'Resolved' | 'Investigating';
  affectedMetrics: string[];
  confidence: number;
}

@Component({
  selector: 'tb-anomalies',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatToolbarModule,
    MatDividerModule,
    FlexLayoutModule,
    WidgetComponentsModule,
    TranslateModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
  ],
  templateUrl: './anomalies.component.html',
  styleUrls: ['./anomalies.component.scss'],
})
export class AnomaliesComponent implements OnInit, OnDestroy {
  @Input() deviceId?: string;

  @Input() forecastId?: string;

  @Input() isExpanded?: boolean;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  @ViewChild(MatSort) sort!: MatSort;

  // WebSocket streaming
  private anomalyStreamSubscription?: Subscription;

  private streamSubscription?: AnomalyStreamSubscription;

  isStreamConnected = false;

  streamError: string | null = null;

  displayedColumns: string[] = [
    'severity',
    'creationDate',
    'componentType',
    'deviceType',
    'location',
    'status',
    'confidence',
    'actions',
  ];

  // Track which columns are pinned/sticky
  stickyColumns: Set<string> = new Set();

  allColumns: DisplayColumn[] = [
    { title: 'Severity', def: 'severity', display: true, selectable: true },
    {
      title: 'Creation Date',
      def: 'creationDate',
      display: true,
      selectable: true,
    },
    {
      title: 'Component Type',
      def: 'componentType',
      display: true,
      selectable: true,
    },
    {
      title: 'Device Type',
      def: 'deviceType',
      display: true,
      selectable: true,
    },
    { title: 'Location', def: 'location', display: true, selectable: true },
    { title: 'Status', def: 'status', display: true, selectable: true },
    { title: 'Confidence', def: 'confidence', display: true, selectable: true },
    { title: 'Actions', def: 'actions', display: true, selectable: false },
  ];

  dataSource = new MatTableDataSource<AnomalyReport>();

  isRefreshing = false;

  // Start with empty array - will be populated only from stream
  private anomalies: AnomalyReport[] = [];

  // Date filter
  filterStartDate: Date | null = null;

  filterHour = 0;

  filterMinute = 0;

  filterSecond = 0;

  constructor(
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    // Start with empty data
    this.dataSource.data = this.anomalies;
    // Pin the actions column by default
    this.stickyColumns.add('actions');

    // Set default filter to last 24 hours with current time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.filterStartDate = yesterday;
    this.filterHour = yesterday.getHours();
    this.filterMinute = yesterday.getMinutes();
    this.filterSecond = yesterday.getSeconds();
    // console.log(
    //   "[Anomalies] Default filter set to last 24 hours from:",
    //   this.getFilterDateTime()
    // );

    // Connect to real-time anomaly stream if forecastId is provided
    if (this.forecastId) {
      this.connectToAnomalyStream();
    }
  }

  ngOnDestroy(): void {
    // this.disconnectFromAnomalyStream();
  }

  // eslint-disable-next-line @angular-eslint/use-lifecycle-interface
  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Set default sort by creation date in descending order
    this.sort.active = 'creationDate';
    this.sort.direction = 'desc';
    this.dataSource.sort = this.sort;
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'error';
      case 'Major':
        return 'warning';
      case 'Minor':
        return 'info';
      default:
        return 'help';
    }
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'warn';
      case 'Major':
        return 'accent';
      case 'Minor':
        return 'primary';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Active':
        return 'play_circle_filled';
      case 'Resolved':
        return 'check_circle';
      case 'Investigating':
        return 'search';
      default:
        return 'help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Active':
        return 'warn';
      case 'Resolved':
        return 'primary';
      case 'Investigating':
        return 'accent';
      default:
        return '';
    }
  }

  formatDate(dateString: string | Date | number): string {
    let date: Date;
    if (typeof dateString === 'string') {
      date = new Date(dateString);
    } else if (typeof dateString === 'number') {
      date = new Date(dateString);
    } else {
      date = dateString;
    }

    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  viewDetails(anomaly: AnomalyReport): void {
    // Implementation for viewing anomaly details
    // console.log("View details for anomaly:", anomaly);
  }

  resolveAnomaly(anomaly: AnomalyReport): void {
    // Implementation for resolving anomaly
    const index = this.anomalies.findIndex((a) => a.id === anomaly.id);
    if (index !== -1) {
      this.anomalies[index].status = 'Resolved';
      this.dataSource.data = [...this.anomalies];
    }
    // console.log("Resolve anomaly:", anomaly);
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity.toLowerCase()}`;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  getConfidenceClass(confidence: number): string {
    if (confidence >= 90) {return 'high-confidence';}
    if (confidence >= 75) {return 'medium-confidence';}
    return 'low-confidence';
  }

  getConfidenceIcon(confidence: number): string {
    if (confidence >= 90) {return 'trending_up';}
    if (confidence >= 75) {return 'trending_flat';}
    return 'trending_down';
  }

  isResolved(status: string): boolean {
    return status === 'Resolved';
  }

  editColumnsToDisplay($event: Event): void {
    if ($event) {
      $event.stopPropagation();
    }

    const target = $event.target || $event.srcElement || $event.currentTarget;
    const config = new OverlayConfig({
      panelClass: 'tb-panel-container',
      backdropClass: 'cdk-overlay-transparent-backdrop',
      hasBackdrop: true,
      height: 'fit-content',
      maxHeight: '75vh',
    });

    config.positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(target as HTMLElement)
      .withPositions(DEFAULT_OVERLAY_POSITIONS);

    const overlayRef = this.overlay.create(config);
    overlayRef.backdropClick().subscribe(() => {
      overlayRef.dispose();
    });

    const columns: DisplayColumn[] = this.allColumns.map((column) => ({
      title: column.title,
      def: column.def,
      display: this.displayedColumns.indexOf(column.def) > -1,
      selectable: column.selectable,
    }));

    const providers: StaticProvider[] = [
      {
        provide: DISPLAY_COLUMNS_PANEL_DATA,
        useValue: {
          columns,
          columnsUpdated: (newColumns: DisplayColumn[]) => {
            this.displayedColumns = newColumns
              .filter((column) => column.display)
              .map((column) => column.def);
            // Update the allColumns display status
            this.allColumns.forEach((col) => {
              const newCol = newColumns.find((nc) => nc.def === col.def);
              if (newCol) {
                col.display = newCol.display;
              }
            });
          },
        } as DisplayColumnsPanelData,
      },
      {
        provide: OverlayRef,
        useValue: overlayRef,
      },
    ];

    const injector = Injector.create({
      parent: this.viewContainerRef.injector,
      providers,
    });
    const componentRef = overlayRef.attach(
      new ComponentPortal(
        DisplayColumnsPanelComponent,
        this.viewContainerRef,
        injector
      )
    );

    const resizeWindows$ = fromEvent(window, 'resize').subscribe(() => {
      overlayRef.updatePosition();
    });
    componentRef.onDestroy(() => {
      resizeWindows$.unsubscribe();
    });
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Toggle column stickiness for vertical scrolling
   */
  toggleColumnSticky(columnDef: string): void {
    if (this.stickyColumns.has(columnDef)) {
      this.stickyColumns.delete(columnDef);
    } else {
      this.stickyColumns.add(columnDef);
    }
  }

  /**
   * Check if a column is currently sticky
   */
  isColumnSticky(columnDef: string): boolean {
    return this.stickyColumns.has(columnDef);
  }

  /**
   * Get the pin icon for a column based on its sticky state
   */
  getPinIcon(columnDef: string): string {
    return this.isColumnSticky(columnDef) ? 'push_pin' : 'push_pin';
  }

  /**
   * Get the tooltip text for the pin button
   */
  getPinTooltip(columnDef: string): string {
    return this.isColumnSticky(columnDef)
      ? 'Unpin column'
      : 'Pin column when scrolling vertically';
  }

  /**
   * Connect to real-time anomaly stream via WebSocket
   */
  private connectToAnomalyStream(): void {
    return;
    if (!this.forecastId) {
      // console.warn(
      //   "[Anomalies] Cannot connect to stream - no forecastId provided"
      // );
      return;
    }

    // Get time window for historical data (including time)
    const filterDateTime = this.getFilterDateTime();
    const startTime = filterDateTime ? filterDateTime.getTime() : undefined;

    this.streamError = null;

    try {
      // this.streamSubscription =
      //   this.anomalyStreamService.subscribeToAnomalyStream(
      //     this.forecastId,
      //     startTime
      //   );

      this.anomalyStreamSubscription =
        this.streamSubscription.observable.subscribe({
          next: (message: AnomalyStreamMessage) => {
            this.handleStreamMessage(message);
          },
          error: (error) => {
            console.error('[Anomalies] WebSocket error:', error);
            this.streamError = `Connection error: ${error}`;
            this.isStreamConnected = false;
            console.error(error.reason);
            // console.log("dadsda");
          },
          complete: () => {
            this.isStreamConnected = false;
          },
        });

      this.isStreamConnected = true;
    } catch (error) {
      console.error('[Anomalies] Failed to connect to stream:', error);
      this.streamError = `Failed to connect: ${error}`;
      this.isStreamConnected = false;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleStreamMessage(message: AnomalyStreamMessage): void {
    // Handle error messages
    if (message.errorCode || message.errorMsg) {
      console.error('[Anomalies] Stream error:', message.errorMsg);
      this.streamError = message.errorMsg || 'Unknown error';
      return;
    }

    const data = message.data;
    if (!data) {
      return;
    }

    // Handle different message types
    switch (data.type) {
      case 'connection':
        this.isStreamConnected = true;
        this.streamError = null;
        break;

      case 'historical':
        // First message: historical data array from database
        if (Array.isArray(data.data)) {
          // console.log(
          //   `[Anomalies] Received ${data.data.length} historical anomalies`
          // );
          this.anomalies = data.data;
          this.filterAnomalies(); // Apply current filter to historical data (internal filtering only)
        }
        break;

      case 'anomaly':
        // Subsequent messages: real-time single anomalies
        if (data.data && !Array.isArray(data.data)) {
          this.handleNewAnomaly(data.data);
        }
        break;

      case 'error':
        console.error('[Anomalies] Stream error:', data.message);
        this.streamError = data.message || 'Stream error';
        break;
    }
  }

  /**
   * Handle new anomaly received from stream
   */
  private handleNewAnomaly(anomaly: AnomalyReport): void {
    // console.log("[Anomalies] New anomaly received:", anomaly);

    // Update creation date to current timestamp (real-time)
    anomaly.creationDate = new Date().toISOString();

    // Add to the top of the list (most recent first)
    this.anomalies = [anomaly, ...this.anomalies];

    // Always show new real-time anomalies in the table
    // They are fresh data that just arrived, so they should be visible
    this.dataSource.data = [anomaly, ...this.dataSource.data];

    // console.log(
    //   `[Anomalies] Added new anomaly to table at ${anomaly.creationDate}. Total: ${this.dataSource.data.length}`
    // );

    // Optional: Limit the list size to prevent memory issues
    const maxAnomalies = 500;
    if (this.anomalies.length > maxAnomalies) {
      this.anomalies = this.anomalies.slice(0, maxAnomalies);
      // console.log(`[Anomalies] Trimmed anomaly list to ${maxAnomalies} items`);
    }

    // Optional: Show notification for critical anomalies
    if (anomaly.severity === 'Critical') {
      // console.warn(
      //   `[Anomalies] CRITICAL: ${anomaly.errorName} - ${anomaly.description}`
      // );
      // TODO: Add toast notification or alert
    }
  }

  /**
   * Refresh table - clears data and reconnects to stream if forecastId present
   */
  refreshTable(): void {
    this.isRefreshing = true;

    // Clear existing data
    this.anomalies = [];
    this.dataSource.data = [];

    if (this.forecastId) {
      // Disconnect and reconnect to real-time stream
      // this.disconnectFromAnomalyStream();

      // Wait a moment before reconnecting to ensure clean disconnection
      setTimeout(() => {
        // this.connectToAnomalyStream();
      }, 500);
    }

    setTimeout(() => {
      this.isRefreshing = false;
      // console.log("[Anomalies] Table refreshed and data cleared");
    }, 1000);
  }

  /**
   * Get filter datetime combining date and time fields
   */
  getFilterDateTime(): Date | null {
    if (!this.filterStartDate) {
      return null;
    }

    const dateTime = new Date(this.filterStartDate);
    dateTime.setHours(this.filterHour || 0);
    dateTime.setMinutes(this.filterMinute || 0);
    dateTime.setSeconds(this.filterSecond || 0);
    dateTime.setMilliseconds(0);

    return dateTime;
  }

  /**
   * Apply date filter to current data and refresh from server
   */
  applyDateFilter(): void {
    const filterDateTime = this.getFilterDateTime();
    if (!filterDateTime) {
      return;
    }

    // console.log("[Anomalies] Applying date filter from:", filterDateTime);

    // Refresh table to fetch new data with updated time window
    this.refreshTable();
  }

  /**
   * Apply date filter to existing anomalies array (internal filtering)
   */
  private filterAnomalies(): void {
    const filterDateTime = this.getFilterDateTime();
    if (!filterDateTime) {
      this.dataSource.data = [...this.anomalies];
      return;
    }

    const filterTime = filterDateTime.getTime();
    const filteredAnomalies = this.anomalies.filter((anomaly) => {
      const anomalyDate = new Date(anomaly.creationDate);
      return anomalyDate.getTime() >= filterTime;
    });

    // console.log(
    //   `[Anomalies] Filtered ${filteredAnomalies.length} of ${this.anomalies.length} anomalies`
    // );
    this.dataSource.data = [...filteredAnomalies];
  }

  /**
   * Clear date filter - resets to default (last 24 hours)
   */
  clearDateFilter(): void {
    // console.log("[Anomalies] Resetting date filter to default (last 24 hours)");

    // Reset to default: last 24 hours with current time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.filterStartDate = yesterday;
    this.filterHour = yesterday.getHours();
    this.filterMinute = yesterday.getMinutes();
    this.filterSecond = yesterday.getSeconds();

    // Apply the default filter
    this.applyDateFilter();
  }
}
