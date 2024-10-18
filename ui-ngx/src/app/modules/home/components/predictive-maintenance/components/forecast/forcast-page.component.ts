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

import { Component, OnInit, ViewChild } from "@angular/core";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatDialog } from "@angular/material/dialog";
import { ForecastService } from "@app/core/http/forecast.service";
import { Direction, PageLink } from "@app/shared/public-api";
import { TranslateModule } from "@ngx-translate/core";
import { FormControl } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatDividerModule } from "@angular/material/divider";
import { AddForecastDialogComponent } from "./add-forecast-dialog/add-forecast-dialog.component";
import { SelectionModel } from "@angular/cdk/collections";
import { TranslateService } from "@ngx-translate/core";
import { ReactiveFormsModule } from "@angular/forms";
import {
  ForecastData,
  Order,
} from "@app/modules/home/models/predictive-maintenance.models";
import { date } from "date-fns/locale/af";
import { Router } from "@angular/router";

@Component({
  selector: "tb-forcast-page",
  templateUrl: "./forcast-page.component.html",
  styleUrls: ["./forcast-page.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTooltipModule,
    MatToolbarModule, // Add MatToolbarModule
    MatSidenavModule,
    MatDividerModule,
    TranslateModule,
    ReactiveFormsModule,
    // Add other necessary modules here
  ],
})
export class ForcastComponent implements OnInit {
  displayedColumns: string[] = [
    "id",
    "device",
    // "user",
    "date",
    "status",
    "action",
  ];

  dataSource = new MatTableDataSource<Order>();
  textSearch = new FormControl();
  selection = new SelectionModel<Order>(true, []);
  isLoading = false;
  totalElements = 0;
  textSearchMode: boolean = false;
  pageLink: PageLink = new PageLink(10, 0, null, {
    property: "createdTime",
    direction: Direction.DESC,
  });

  translations: any;
  pageSizeOptions = [5, 10, 25, 100];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialog: MatDialog,
    private forecastService: ForecastService,
    private translate: TranslateService,
    private router: Router
  ) {
    this.translations = {
      search: this.translate.instant("search"),
      close: this.translate.instant("action.close"),
    };
  }

  ngOnInit() {
    // Initialization logic
  }
  ngAfterViewInit() {
    console.log("here");
    this.fetchForecasts();
  }

  trackByEntityId(index: number, entity: Order): string {
    return entity.id; // Ensure id exists
  }

  trackByColumnKey(index: number, column: any): string {
    return column.key; // Ensure key exists
  }

  cellContent(entity: Order, column: any): string {
    return entity[column.key]; // Replace with your logic
  }

  structureDate(fetchedData: any[]): Order[] {
    return fetchedData.map((item) => ({
      id: item.id.id.split("-")[0], // Getting the id from the nested object
      device: item.deviceId.id.split("-")[0], // Getting the device id
      date: new Date(item.createdTime).toISOString().split("T")[0], // Formatting the createdTime to yyyy-mm-dd
      status: "Completed", // Default status as Completed
    }));
  }

  fetchForecasts(): void {
    this.isLoading = true;
    const pageSize = this.paginator.pageSize || 10;
    const pageIndex = this.paginator.pageIndex || 0;
    const sortProperty = this.sort.active || "createdTime";
    const sortDirection: Direction =
      this.sort.direction === "asc" ? Direction.ASC : Direction.DESC;

    const pageLink = new PageLink(pageSize, pageIndex, null, {
      property: sortProperty,
      direction: sortDirection,
    });

    this.forecastService.getForecastsByPage(pageLink).subscribe(
      (data) => {
        console.log("data === ", data);
        this.dataSource.data = this.structureDate(data.data);
        this.totalElements = data.totalElements;
        this.isLoading = false;
      },
      (error) => {
        console.error("Error fetching forecasts:", error);
        this.isLoading = false;
      }
    );
  }

  openAddForecastDialog(): void {
    const dialogRef = this.dialog.open(AddForecastDialogComponent, {
      width: "600px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log("result === ", result);
        this.addForecast(result); // Call addForecast if a result is returned
      }
    });
  }

  addForecast(forecast: any): void {
    // Call the service to add a forecast
    this.forecastService.addForecast(forecast).subscribe(
      () => {
        this.fetchForecasts(); // Refresh forecasts after adding a new one
      },
      (error) => {
        console.error("Error adding forecast:", error);
      }
    );
  }

  editForecast(forecast: Order): void {
    // Open the dialog with the existing forecast data
    const dialogRef = this.dialog.open(AddForecastDialogComponent, {
      width: "600px",
      data: forecast, // Pass the current forecast data to the dialog
    });

    dialogRef.afterClosed().subscribe((updatedForecast) => {
      if (updatedForecast) {
        this.updateForecast(updatedForecast); // Update forecast if a result is returned
      }
    });
  }

  updateForecast(forecast: Order): void {
    // Call the service to update the forecast
    this.forecastService.updateForecast(forecast).subscribe(
      () => {
        this.fetchForecasts(); // Refresh forecasts after updating
      },
      (error) => {
        console.error("Error updating forecast:", error);
      }
    );
  }

  deleteForecast(forecastId: string): void {
    // Call the service to delete the forecast
    this.forecastService.deleteForecast(forecastId).subscribe(
      () => {
        this.fetchForecasts(); // Refresh forecasts after deleting
      },
      (error) => {
        console.error("Error deleting forecast:", error);
      }
    );
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  exitFilterMode() {
    this.textSearchMode = false; // Example logic to exit search mode
  }
  openForcastModel(row: Order) {
    this.router.navigateByUrl(`/PM/anomaly-detection/${row.id}`);
  }
  // Rest of the methods (add, edit, delete, etc.)
}
