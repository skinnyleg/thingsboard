import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AppState } from "@app/core/core.state";
import { ForecastService } from "@app/core/http/forecast.service";
import { Order } from "@app/modules/home/models/predictive-maintenance.models";
import { PageComponent } from "@app/shared/public-api";
import { Store } from "@ngrx/store";
import { MatDialog } from "@angular/material/dialog";
import { AddForecastDialogComponent } from "../../../components/predictive-maintenance/components/forecast/add-forecast-dialog/add-forecast-dialog.component";
import { ModelSelectionDialogComponent } from "./model-selection-dialog/model-selection-dialog.component";

@Component({
  selector: "forecast",
  templateUrl: "./forecast.component.html",
  styleUrls: ["./forecast.component.scss"],
})
export class ForecastComponent extends PageComponent implements Order {
  deviceId: string; // To pass to the chart
  Attributes: string[]; // To store the temperature data
  forecastData: Order[];

  models: Order[];
  filteredModels: Order[] = []; // For storing filtered models
  modelSearchTerm: string = ""; // Search term for filtering models
  modelNames: Map<string, string> = new Map(); // Cache for model names
  id: string;
  trueId: string;
  device: string;
  forecastName: string;
  date: string;
  status: string;

  constructor(
    protected store: Store<AppState>,
    protected route: ActivatedRoute,
    private forecastService: ForecastService,
    protected router: Router,
    public dialog: MatDialog
  ) {
    super(store);
  }

  changeModel(value: any) {
    this.router.navigateByUrl("/predictiveMaintenance/forecast/" + value);

    this.deviceId = "";
    this.Attributes = [];
    this.trueId = value;
    this.fetchForcast(value);
  }

  openModelSelectionDialog(): void {
    const dialogRef = this.dialog.open(ModelSelectionDialogComponent, {
      width: "600px",
      data: {
        models: this.models,
        currentModelId: this.id,
        getModelDisplayName: (model: any) => this.getModelDisplayName(model),
      },
    });

    dialogRef.afterClosed().subscribe((selectedModel: Order) => {
      if (selectedModel && selectedModel.trueId !== this.id) {
        this.changeModel(selectedModel.trueId);
      }
    });
  }
  ngOnInit(): void {
    // Check if data was passed via the router's state
    if (history.state && history.state.forecastData) {
      this.forecastData = history.state.forecastData;
      // console.log("Forecast data received:", this.forecastData);
    } else {
      // Optionally, handle the case when data is not passed
      console.error("No forecast data passed.");
    }
    this.init();
  }

  private init() {
    this.route.params.subscribe((params) => {
      if (params.id) {
        this.id = params.id;
        this.fetchForcast(params.id);
        this.models = this.forecastData;
        // console.log("models === ", this.models);
        if (this.models === undefined || this.models.length === 0) {
          return this.router.navigateByUrl("/PM");
        }

        // Initialize filtered models
        this.updateFilteredModels();

        // Fetch names for all models
        this.fetchModelNames();

        const forecast = this.models.find(
          (element) => element.trueId === this.id
        );
        if (!forecast) return this.router.navigateByUrl("");
        this.device = forecast.device;
        this.forecastName = forecast.id; // Use the forecast ID as the name
        this.date = forecast.date;
        this.status = forecast.status;
      }
    });
  }

  private fetchModelNames() {
    if (this.models && this.models.length > 0) {
      this.models.forEach((model) => {
        this.forecastService.getForecast(model.trueId).subscribe(
          (data) => {
            const name = data.name || data.id.id.split("-")[0];
            this.modelNames.set(model.trueId, name);
            // Update filtered models after names are fetched
            this.filterModels();
          },
          (error) => {
            console.error(
              "Error fetching forecast name for",
              model.trueId,
              error
            );
            // Fallback to the existing ID
            this.modelNames.set(model.trueId, model.id);
            // Update filtered models even on error
            this.filterModels();
          }
        );
      });
    }
  }

  getModelDisplayName(model: any): string {
    return this.modelNames.get(model.trueId) || model.id;
  }

  filterModels(): void {
    if (!this.modelSearchTerm || this.modelSearchTerm.trim() === "") {
      this.filteredModels = [...this.models];
    } else {
      const searchTerm = this.modelSearchTerm.toLowerCase();
      this.filteredModels = this.models.filter(
        (model) =>
          this.getModelDisplayName(model).toLowerCase().includes(searchTerm) ||
          model.device.toLowerCase().includes(searchTerm) ||
          model.date.toLowerCase().includes(searchTerm) ||
          model.status.toLowerCase().includes(searchTerm)
      );
    }
  }

  private updateFilteredModels(): void {
    this.filteredModels = [...this.models];
    this.modelSearchTerm = ""; // Reset search term when models change
  }

  fetchForcast(forcastId: string): any {
    this.forecastService.getForecast(forcastId).subscribe(
      (data) => {
        this.deviceId = data.deviceId.id;
        this.Attributes = data.attributes.map((attr) => {
          return attr.key;
        });
        this.trueId = data.id.id;
        this.forecastName = data.name || data.id.id.split("-")[0]; // Use name if available, fallback to ID
      },
      (error) => {
        console.error("Error fetching forecast:", error);
      }
    );
  }

  openCreateModelDialog(): void {
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
      (response) => {
        console.log("Forecast created successfully:", response);
        // Navigate back to the forecast list to see the new model
        this.router.navigateByUrl("/PM");
      },
      (error) => {
        console.error("Error adding forecast:", error);
      }
    );
  }
}
