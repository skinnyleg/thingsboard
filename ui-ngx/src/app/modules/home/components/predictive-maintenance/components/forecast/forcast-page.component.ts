import { Component, OnInit, ViewChild } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatSortModule } from "@angular/material/sort";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";
import { CommonModule } from "@angular/common";
import { MatDialog } from "@angular/material/dialog";
import { AddForecastDialogComponent } from "../forecast/add-forecast-dialog/add-forecast-dialog.component";
import { ForecastService } from "@app/core/http/forecast.service";
import { Direction, PageLink } from "@app/shared/public-api";
// import { ForecastService } from '../../services/forecast.service'; // Import ForecastService

export interface Order {
  id: string;
  device: string;
  user: string;
  date: string;
  status: string;
}

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
  dataSource = new MatTableDataSource<Order>();

  isLoading = false; // Track the loading state
  totalElements = 0; // Track the total number of elements for pagination
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    public dialog: MatDialog,
    private forecastService: ForecastService // Inject ForecastService
  ) {}

  ngOnInit() {
    // this.fetchForecasts(); // Load data on initialization
  }

  fetchForecasts(): void {
    // Set the loading state (could show a spinner in the UI)
    this.isLoading = true;

    // Get the current pagination and sorting settings
    const pageSize = this.paginator?.pageSize || 10;
    const pageIndex = this.paginator?.pageIndex || 0;
    const sortProperty = this.sort?.active || "createdTime";
    const sortDirection: Direction =
      this.sort?.direction === "asc" ? Direction.ASC : Direction.DESC;

    // Create a new PageLink with pagination and sorting details
    const pageLink = new PageLink(pageSize, pageIndex, null, {
      property: sortProperty,
      direction: sortDirection,
    });

    // Fetch forecasts from the service
    this.forecastService.getForecastsByPage(pageLink).subscribe(
      (data) => {
        // Assign fetched data to the dataSource
        this.dataSource.data = data.data; // Assuming `data.data` holds the forecasts
        this.dataSource.paginator = this.paginator; // Link paginator
        this.dataSource.sort = this.sort; // Link sorting

        // Update the total number of elements for pagination
        this.totalElements = data.totalElements;

        // End the loading state
        this.isLoading = false;
      },
      (error) => {
        // Handle errors gracefully
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
}
