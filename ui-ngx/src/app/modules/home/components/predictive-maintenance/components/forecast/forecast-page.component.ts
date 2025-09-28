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

import { SelectionModel } from "@angular/cdk/collections";
import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDialog } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import {
  MatPaginator,
  MatPaginatorModule,
  PageEvent,
} from "@angular/material/paginator";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatListModule } from "@angular/material/list";
import { MatMenuModule } from "@angular/material/menu";
import { Router } from "@angular/router";
import { ForecastService } from "@app/core/http/forecast.service";
import { DeviceService, DialogService } from "@app/core/public-api";
import {
  ELEMENT_DATA,
  Order,
} from "@app/modules/home/models/predictive-maintenance.models";
import { Direction, PageLink } from "@app/shared/public-api";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { catchError, forkJoin, of, tap } from "rxjs";
import { AddForecastDialogComponent } from "./add-forecast-dialog/add-forecast-dialog.component";

@Component({
  selector: "tb-forecast-page",
  templateUrl: "./forecast-page.component.html",
  styleUrls: ["./forecast-page.component.scss"],
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
    MatToolbarModule,
    MatSidenavModule,
    MatDividerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatListModule,
    MatMenuModule,
    TranslateModule,
    ReactiveFormsModule,
  ],
})
export class ForecastComponent implements OnInit {
  // All available columns with their display names
  allColumns = [
    { key: "id", name: "ID", visible: false }, // Hidden by default
    { key: "modelName", name: "Name", visible: true },
    { key: "device", name: "Device", visible: true },
    { key: "attributes", name: "Attributes", visible: true },
    { key: "date", name: "Creation Time", visible: true },
    { key: "status", name: "Status", visible: true },
    { key: "action", name: "Actions", visible: true, permanent: true }, // Actions column always visible
  ];

  // Get currently displayed columns based on visibility
  get displayedColumns(): string[] {
    return this.allColumns
      .filter((column) => column.visible)
      .map((column) => column.key);
  }

  // Get columns that can be toggled (excluding permanent ones)
  get toggleableColumns() {
    return this.allColumns.filter((column) => !column.permanent);
  }

  dataSource = new MatTableDataSource<Order>();
  textSearch = new FormControl();
  selection = new SelectionModel<Order>(true, []);
  isLoading = false;
  totalElements = 0;
  textSearchMode: boolean = false;
  toolbarOpened: boolean = true; // Add toolbar state
  models: Order[] = []; // For storing available models
  pageLink: PageLink = new PageLink(10, 0, null, {
    property: "createdTime",
    direction: Direction.DESC,
  });

  translations: any;
  pageSizeOptions = [5, 10, 25, 100];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild("searchInput") searchInputField!: ElementRef;

  constructor(
    public dialog: MatDialog,
    private forecastService: ForecastService,
    private deviceService: DeviceService,
    private translate: TranslateService,
    private router: Router,
    private dialogService: DialogService
  ) {
    this.translations = {
      search: this.translate.instant("search"),
      close: this.translate.instant("action.close"),
    };
  }

  ngOnInit() {
    // this.fetchForecasts(0, 10);
    // Initialization logic
  }
  ngAfterViewInit() {
    // console.log("pageLink === ", this.pageLink);
    // this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    // this.paginator.page.subscribe(() => {
    //   this.fetchForecasts(); // Fetch new data when page changes
    // });
    // this.fetchForecasts(false);
    this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize);
    this.paginator.page.subscribe(() => {
      console.log("paginator ==== ", this.paginator);
      this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize);
    });
  }

  structureDate(
    fetchedData: any[],
    deviceNameMap: Map<string, string>
  ): Order[] {
    return fetchedData.map((item) => ({
      id: item.id.id.split("-")[0], // Getting the id from the nested object
      trueId: item.id.id,
      device:
        deviceNameMap.get(item.deviceId.id) || item.deviceId.id.split("-")[0],
      modelName:
        item.name ||
        item.modelName ||
        item.title ||
        `Model_${item.id.id.split("-")[0]}`, // Use actual model name from API response
      date: new Date(item.createdTime).toISOString().split("T")[0], // Formatting the createdTime to yyyy-mm-dd
      status: item.status || "Completed", // Use actual status from API or default to Completed
      attributesText:
        item.attributes && item.attributes.length > 0
          ? item.attributes.map((attr: any) => attr.key).join(", ")
          : "", // Convert attributes array to comma-separated string
    }));
  }

  fetchForecasts(pageIndex: number, pageSize: number): void {
    this.isLoading = true;
    let size = pageSize || 10;
    let index = pageIndex || 0;
    let sortPro = this.sort.active || "createdTime";
    let sortDir: Direction =
      this.sort.direction === "asc" ? Direction.ASC : Direction.DESC;

    const pageLink = new PageLink(size, index, null, {
      property: sortPro,
      direction: sortDir,
    });
    // console.log("pageIndex === ", pageIndex);
    // console.log("pageSize === ", pageSize);
    this.forecastService.getForecastsByPage(pageLink).subscribe(
      (data) => {
        const deviceNameMap = new Map<string, string>();
        const forecastData = data.data;
        console.log("Forecast API response data:", data);
        console.log("Sample forecast item:", forecastData[0]);
        if (forecastData.length === 0) {
          this.dataSource.data = [];
          this.totalElements = data.totalElements;
          this.isLoading = false;
        }

        const deviceRequests = forecastData.map((forecast) => {
          const deviceId = forecast.deviceId.id;
          return this.deviceService.getDevice(deviceId).pipe(
            // Store the device name in the map when fetched
            tap((deviceInfo) => deviceNameMap.set(deviceId, deviceInfo.name)),
            catchError((error) => {
              console.error("Error fetching device info:", error);
              return of(null); // Return a null observable if there's an error
            })
          );
        });
        forkJoin(deviceRequests).subscribe(() => {
          const newData = this.structureDate(forecastData, deviceNameMap);
          this.dataSource.data = newData;
          this.models = [...newData]; // Populate models for the selector
          this.totalElements = data.totalElements;
          this.isLoading = false;
        });
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
        this.addForecast(result); // Call addForecast if a result is returned
      }
    });
  }

  addForecast(forecast: any): void {
    // Call the service to add a forecast
    this.forecastService.addForecast(forecast).subscribe(
      () => {
        this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize); // Refresh forecasts after adding a new one
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
        this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize); // Refresh forecasts after updating
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
        console.log("pageIndex === ", this.paginator.pageIndex);
        this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize); // Refresh forecasts after deleting
      },
      (error) => {
        console.error("Error deleting forecast:", error);
      }
    );
  }

  confirmDeleteForecast(event: Event, forecast: Order): void {
    if (event) {
      event.stopPropagation();
    }
    const modelName = forecast.modelName || forecast.id || "Unknown Model";
    const title = this.translate.instant("forecast.delete-model-title");
    const content = this.translate.instant("forecast.delete-model-text", {
      modelName: modelName,
    });
    this.dialogService
      .confirm(
        title,
        content,
        this.translate.instant("action.no"),
        this.translate.instant("action.yes")
      )
      .subscribe((result) => {
        if (result) {
          this.deleteForecast(forecast.trueId);
        }
      });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  enterFilterMode() {
    this.textSearchMode = true;
    setTimeout(() => {
      this.searchInputField.nativeElement.focus();
      this.searchInputField.nativeElement.setSelectionRange(0, 0);
    }, 10);
  }

  exitFilterMode() {
    this.textSearchMode = false;
    this.textSearch.reset();
  }
  openForecastModel(row: Order) {
    this.router.navigateByUrl(`/predictiveMaintenance/forecast/${row.trueId}`, {
      state: { forecastData: this.dataSource.data },
    });
  }

  toggleColumnVisibility(columnKey: string): void {
    const column = this.allColumns.find((col) => col.key === columnKey);
    if (column && !column.permanent) {
      column.visible = !column.visible;
    }
  }

  toggleToolbar(): void {
    this.toolbarOpened = !this.toolbarOpened;
  }

  refreshForecasts(): void {
    this.fetchForecasts(this.paginator.pageIndex, this.paginator.pageSize);
  }

  // Rest of the methods (add, edit, delete, etc.)
}
