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

import { Component, Inject, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from "@angular/material/dialog";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslateModule } from "@ngx-translate/core";

export interface StatusItem {
  id: string;
  timestamp: Date;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  source?: string;
  resolved: boolean;
}

export interface StatusDialogData {
  title: string;
  type: "errors" | "failures" | "maintenance";
  deviceId: string;
  modelId: string;
  count: number;
}

@Component({
  selector: "tb-status-dialog",
  templateUrl: "./status-dialog.component.html",
  styleUrls: ["./status-dialog.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
  ],
})
export class StatusDialogComponent implements OnInit {
  displayedColumns: string[] = [
    "timestamp",
    "severity",
    "message",
    "source",
    "resolved",
    "actions",
  ];
  dataSource = new MatTableDataSource<StatusItem>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<StatusDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StatusDialogData
  ) {}

  ngOnInit(): void {
    this.loadStatusItems();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadStatusItems(): void {
    // TODO: Replace with actual API call
    const mockData = this.generateMockData();
    this.dataSource.data = mockData;
  }

  generateMockData(): StatusItem[] {
    const items: StatusItem[] = [];
    const count = this.data.count || 5;

    const messages = {
      errors: [
        "Connection timeout occurred",
        "Data validation failed",
        "Sensor reading out of range",
        "Communication error with device",
        "Invalid data format received",
      ],
      failures: [
        "Model prediction failed",
        "Training process interrupted",
        "Insufficient data for prediction",
        "Algorithm convergence failure",
        "Resource allocation failed",
      ],
      maintenance: [
        "Scheduled maintenance required",
        "Calibration needed",
        "Firmware update available",
        "Component replacement recommended",
        "Performance degradation detected",
      ],
    };

    const severities: Array<"low" | "medium" | "high" | "critical"> = [
      "low",
      "medium",
      "high",
      "critical",
    ];
    const messageList = messages[this.data.type];

    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setHours(date.getHours() - Math.floor(Math.random() * 24));

      items.push({
        id: `${this.data.type}-${i}`,
        timestamp: date,
        message: messageList[i % messageList.length],
        severity: severities[Math.floor(Math.random() * severities.length)],
        source: this.data.modelId,
        resolved: Math.random() > 0.5,
      });
    }

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity}`;
  }

  getSeverityIcon(severity: string): string {
    const icons = {
      low: "info",
      medium: "warning",
      high: "error",
      critical: "dangerous",
    };
    return icons[severity] || "info";
  }

  resolveItem(item: StatusItem): void {
    item.resolved = !item.resolved;
    // TODO: Call API to update resolved status
  }

  deleteItem(item: StatusItem): void {
    const index = this.dataSource.data.indexOf(item);
    if (index >= 0) {
      this.dataSource.data.splice(index, 1);
      this.dataSource._updateChangeSubscription();
    }
    // TODO: Call API to delete item
  }

  close(): void {
    this.dialogRef.close();
  }

  getUnresolvedCount(): number {
    return this.dataSource.data.filter((item) => !item.resolved).length;
  }
}
