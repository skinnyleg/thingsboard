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
import { Order } from "@app/modules/home/models/predictive-maintenance.models";

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
    "user",
    "date",
    "status",
    "action",
  ];
  entityColumns = [
    { key: "id", title: "ID" },
    { key: "device", title: "Device" },
    { key: "user", title: "User" },
    { key: "date", title: "Date" },
    { key: "status", title: "Status" },
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
    private translate: TranslateService
  ) {
    this.translations = {
      search: this.translate.instant("search"),
      close: this.translate.instant("action.close"),
    };
  }

  ngOnInit() {
    // Initialization logic
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
        this.dataSource.data = data.data;
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

  // Rest of the methods (add, edit, delete, etc.)
}
