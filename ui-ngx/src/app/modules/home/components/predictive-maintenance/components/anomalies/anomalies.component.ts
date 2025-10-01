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
  ViewChild,
  ViewContainerRef,
  Injector,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatPaginatorModule, MatPaginator } from "@angular/material/paginator";
import { MatSortModule, MatSort } from "@angular/material/sort";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCardModule } from "@angular/material/card";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatDividerModule } from "@angular/material/divider";
import { FlexLayoutModule } from "@angular/flex-layout";
import {
  ConnectedPosition,
  Overlay,
  OverlayConfig,
  OverlayRef,
} from "@angular/cdk/overlay";
import { ComponentPortal } from "@angular/cdk/portal";
import { StaticProvider } from "@angular/core";
import { fromEvent } from "rxjs";
import {
  DISPLAY_COLUMNS_PANEL_DATA,
  DisplayColumnsPanelComponent,
  DisplayColumnsPanelData,
} from "@home/components/widget/lib/display-columns-panel.component";
import { DisplayColumn } from "@home/components/widget/lib/table-widget.models";
import { DEFAULT_OVERLAY_POSITIONS } from "@shared/models/overlay.models";
import { WidgetComponentsModule } from "@home/components/widget/widget-components.module";
import { TranslateModule, TranslateService } from "@ngx-translate/core";

export interface AnomalyReport {
  id: string;
  reportEntity: string;
  errorName: string;
  severity: "Critical" | "Major" | "Minor";
  creationDate: string;
  componentType: string;
  deviceType: string;
  location: string;
  description: string;
  status: "Active" | "Resolved" | "Investigating";
  affectedMetrics: string[];
  confidence: number;
}

@Component({
  selector: "tb-anomalies",
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
  ],
  templateUrl: "./anomalies.component.html",
  styleUrls: ["./anomalies.component.scss"],
})
export class AnomaliesComponent implements OnInit {
  @Input() deviceId?: string;
  @Input() forecastId?: string;
  @Input() isExpanded?: boolean;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    "severity",
    "creationDate",
    "componentType",
    "deviceType",
    "location",
    "status",
    "confidence",
    "actions",
  ];

  // Track which columns are pinned/sticky
  stickyColumns: Set<string> = new Set();

  allColumns: DisplayColumn[] = [
    { title: "Severity", def: "severity", display: true, selectable: true },
    {
      title: "Creation Date",
      def: "creationDate",
      display: true,
      selectable: true,
    },
    {
      title: "Component Type",
      def: "componentType",
      display: true,
      selectable: true,
    },
    {
      title: "Device Type",
      def: "deviceType",
      display: true,
      selectable: true,
    },
    { title: "Location", def: "location", display: true, selectable: true },
    { title: "Status", def: "status", display: true, selectable: true },
    { title: "Confidence", def: "confidence", display: true, selectable: true },
    { title: "Actions", def: "actions", display: true, selectable: false },
  ];

  dataSource = new MatTableDataSource<AnomalyReport>();

  isRefreshing = false;

  constructor(
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private translate: TranslateService
  ) {}

  // Hardcoded anomaly data
  private anomalies: AnomalyReport[] = [
    {
      id: "1",
      reportEntity: "Temperature Monitoring System",
      errorName: "Thermal Anomaly Detected",
      severity: "Critical",
      creationDate: "2024-09-25T14:30:00Z",
      componentType: "comp1",
      deviceType: "Temperature Sensor",
      location: "Building A - Floor 2",
      description: "Temperature reading exceeded normal threshold by 15°C",
      status: "Active",
      affectedMetrics: ["Temperature", "Heat Index"],
      confidence: 95.5,
    },
    {
      id: "2",
      reportEntity: "Vibration Analysis Module",
      errorName: "Excessive Vibration Pattern",
      severity: "Major",
      creationDate: "2024-09-25T12:15:00Z",
      componentType: "comp2",
      deviceType: "Vibration Sensor",
      location: "Production Line 1",
      description: "Unusual vibration pattern detected in machinery operation",
      status: "Investigating",
      affectedMetrics: ["Vibration Amplitude", "Frequency"],
      confidence: 87.2,
    },
    {
      id: "3",
      reportEntity: "Pressure Monitoring Unit",
      errorName: "Pressure Drop Alert",
      severity: "Major",
      creationDate: "2024-09-25T10:45:00Z",
      componentType: "comp3",
      deviceType: "Pressure Sensor",
      location: "Hydraulic System",
      description: "Significant pressure drop detected in main hydraulic line",
      status: "Resolved",
      affectedMetrics: ["Pressure", "Flow Rate"],
      confidence: 92.1,
    },
    {
      id: "4",
      reportEntity: "Humidity Control System",
      errorName: "Humidity Spike Detected",
      severity: "Minor",
      creationDate: "2024-09-25T09:20:00Z",
      componentType: "comp4",
      deviceType: "Humidity Sensor",
      location: "Storage Room C",
      description: "Humidity level temporarily exceeded normal range",
      status: "Resolved",
      affectedMetrics: ["Humidity", "Dew Point"],
      confidence: 78.9,
    },
    {
      id: "5",
      reportEntity: "Power Management System",
      errorName: "Power Consumption Anomaly",
      severity: "Critical",
      creationDate: "2024-09-25T08:00:00Z",
      componentType: "comp5",
      deviceType: "Power Meter",
      location: "Main Electrical Panel",
      description: "Unexpected power consumption spike detected",
      status: "Active",
      affectedMetrics: ["Power Consumption", "Voltage", "Current"],
      confidence: 96.8,
    },
    {
      id: "6",
      reportEntity: "Air Quality Monitor",
      errorName: "Air Quality Degradation",
      severity: "Major",
      creationDate: "2024-09-25T07:30:00Z",
      componentType: "comp1",
      deviceType: "Air Quality Sensor",
      location: "Office Area 1",
      description: "CO2 levels exceeded recommended thresholds",
      status: "Investigating",
      affectedMetrics: ["CO2 Level", "Air Quality Index"],
      confidence: 89.4,
    },
    {
      id: "7",
      reportEntity: "Flow Measurement System",
      errorName: "Flow Rate Irregularity",
      severity: "Minor",
      creationDate: "2024-09-25T06:45:00Z",
      componentType: "comp2",
      deviceType: "Flow Sensor",
      location: "Water Supply Line",
      description: "Minor fluctuations in water flow rate detected",
      status: "Resolved",
      affectedMetrics: ["Flow Rate", "Pressure"],
      confidence: 75.3,
    },
    {
      id: "8",
      reportEntity: "Motion Detection System",
      errorName: "Unexpected Motion Pattern",
      severity: "Minor",
      creationDate: "2024-09-25T05:15:00Z",
      componentType: "comp3",
      deviceType: "Motion Sensor",
      location: "Security Zone 2",
      description: "Unusual motion pattern detected during off-hours",
      status: "Investigating",
      affectedMetrics: ["Motion Detection", "Activity Level"],
      confidence: 82.7,
    },
    {
      id: "9",
      reportEntity: "Sound Level Monitor",
      errorName: "Noise Level Anomaly",
      severity: "Major",
      creationDate: "2024-09-24T23:30:00Z",
      componentType: "comp4",
      deviceType: "Sound Level Meter",
      location: "Machine Shop",
      description: "Abnormal noise levels detected from equipment",
      status: "Active",
      affectedMetrics: ["Sound Level", "Frequency Spectrum"],
      confidence: 91.2,
    },
    {
      id: "10",
      reportEntity: "Chemical Level Monitor",
      errorName: "Chemical Concentration Alert",
      severity: "Critical",
      creationDate: "2024-09-24T22:00:00Z",
      componentType: "comp5",
      deviceType: "Chemical Sensor",
      location: "Treatment Plant",
      description: "Chemical concentration levels outside safe operating range",
      status: "Active",
      affectedMetrics: ["Chemical Concentration", "pH Level"],
      confidence: 97.6,
    },
  ];

  ngOnInit(): void {
    this.dataSource.data = this.anomalies;
    // Pin the actions column by default
    this.stickyColumns.add("actions");
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Set default sort by creation date in descending order
    this.sort.active = "creationDate";
    this.sort.direction = "desc";
    this.dataSource.sort = this.sort;
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case "Critical":
        return "error";
      case "Major":
        return "warning";
      case "Minor":
        return "info";
      default:
        return "help";
    }
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case "Critical":
        return "warn";
      case "Major":
        return "accent";
      case "Minor":
        return "primary";
      default:
        return "";
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case "Active":
        return "play_circle_filled";
      case "Resolved":
        return "check_circle";
      case "Investigating":
        return "search";
      default:
        return "help";
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case "Active":
        return "warn";
      case "Resolved":
        return "primary";
      case "Investigating":
        return "accent";
      default:
        return "";
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  }

  viewDetails(anomaly: AnomalyReport): void {
    // Implementation for viewing anomaly details
    console.log("View details for anomaly:", anomaly);
  }

  resolveAnomaly(anomaly: AnomalyReport): void {
    // Implementation for resolving anomaly
    const index = this.anomalies.findIndex((a) => a.id === anomaly.id);
    if (index !== -1) {
      this.anomalies[index].status = "Resolved";
      this.dataSource.data = [...this.anomalies];
    }
    console.log("Resolve anomaly:", anomaly);
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity.toLowerCase()}`;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  getConfidenceClass(confidence: number): string {
    if (confidence >= 90) return "high-confidence";
    if (confidence >= 75) return "medium-confidence";
    return "low-confidence";
  }

  getConfidenceIcon(confidence: number): string {
    if (confidence >= 90) return "trending_up";
    if (confidence >= 75) return "trending_flat";
    return "trending_down";
  }

  isResolved(status: string): boolean {
    return status === "Resolved";
  }

  editColumnsToDisplay($event: Event): void {
    if ($event) {
      $event.stopPropagation();
    }

    const target = $event.target || $event.srcElement || $event.currentTarget;
    const config = new OverlayConfig({
      panelClass: "tb-panel-container",
      backdropClass: "cdk-overlay-transparent-backdrop",
      hasBackdrop: true,
      height: "fit-content",
      maxHeight: "75vh",
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

    const resizeWindows$ = fromEvent(window, "resize").subscribe(() => {
      overlayRef.updatePosition();
    });
    componentRef.onDestroy(() => {
      resizeWindows$.unsubscribe();
    });
  }

  refreshTable(): void {
    this.isRefreshing = true;

    // Simulate API call delay
    setTimeout(() => {
      // In a real application, this would make an API call to fetch fresh data
      // For now, we'll just refresh the current data
      this.dataSource.data = [...this.anomalies];
      this.isRefreshing = false;

      // Optional: Add a console log to show refresh completed
      console.log("Anomalies table refreshed");
    }, 1000);
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
    return this.isColumnSticky(columnDef) ? "push_pin" : "push_pin";
  }

  /**
   * Get the tooltip text for the pin button
   */
  getPinTooltip(columnDef: string): string {
    return this.isColumnSticky(columnDef)
      ? "Unpin column"
      : "Pin column when scrolling vertically";
  }
}
