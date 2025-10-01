import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AppState } from "@app/core/core.state";
import { ForecastService } from "@app/core/http/forecast.service";
import { Order } from "@app/modules/home/models/predictive-maintenance.models";
import { PageComponent } from "@app/shared/public-api";
import {
  ForecastStatus,
  getForecastStatusFromString,
  getForecastStatusDisplayText,
  isForecastActive,
  getForecastViewPreferences,
  setForecastViewPreferences,
} from "@app/shared/models/forecast.models";
import {
  ForecastViewType,
  ForecastViewPreferences,
  DEFAULT_VIEW_PREFERENCES,
  parseForecastViewPreferences,
  stringifyForecastViewPreferences,
  isForecastViewSelected,
  isAnomalyViewSelected,
} from "@app/shared/models/forecast-view-preferences.models";
import { Store } from "@ngrx/store";
import { MatDialog } from "@angular/material/dialog";
import { AddForecastDialogComponent } from "../../../components/predictive-maintenance/components/forecast/add-forecast-dialog/add-forecast-dialog.component";
import { ModelSelectionDialogComponent } from "./model-selection-dialog/model-selection-dialog.component";
import { AnomaliesComponent } from "../../../components/predictive-maintenance/components/anomalies/anomalies.component";
import { CommonModule } from "@angular/common";
import { ForecastChartComponent } from "../../../components/predictive-maintenance/components/forecast-chart/forecast-chart.component";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from "@angular/animations";

@Component({
  selector: "tb-forecast",
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    FormsModule,
    ForecastChartComponent,
    AnomaliesComponent,
    MatTooltipModule,
    MatCheckboxModule,
    TranslateModule,
  ],
  templateUrl: "./forecast.component.html",
  styleUrls: ["./forecast.component.scss"],
  animations: [
    trigger("slideCollapse", [
      state(
        "expanded",
        style({ height: "*", opacity: 1, overflow: "visible" })
      ),
      state(
        "collapsed",
        style({ height: "0", opacity: 0, overflow: "hidden" })
      ),
      transition(
        "expanded <=> collapsed",
        animate("300ms cubic-bezier(0.4, 0.0, 0.2, 1)")
      ),
    ]),
  ],
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
  status: string = "";

  // Collapse/expand states for charts
  forecastChartCollapsed: boolean = false;
  anomaliesCollapsed: boolean = false;

  // View selector options
  viewOptions = [
    {
      value: ForecastViewType.FORECAST,
      label: "Show Forecast",
      icon: "trending_up",
    },
    {
      value: ForecastViewType.ANOMALIES,
      label: "Show Anomalies",
      icon: "bug_report",
    },
  ];
  selectedViews: ForecastViewType[] = [
    ForecastViewType.FORECAST,
    ForecastViewType.ANOMALIES,
  ];
  showViewSelector: boolean = false;

  constructor(
    protected store: Store<AppState>,
    protected route: ActivatedRoute,
    private forecastService: ForecastService,
    protected router: Router,
    public dialog: MatDialog,
    private translate: TranslateService
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

    // Load collapsed states from localStorage
    this.loadCollapsedStates();

    // Add document click listener for view selector dropdown
    this.addDocumentClickListener();

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

        // Load view preferences for the current forecast
        if (this.trueId !== params.id) {
          this.trueId = params.id;
          this.loadViewPreferences();
        }

        const forecast = this.models.find(
          (element) => element.trueId === this.id
        );
        if (!forecast) return this.router.navigateByUrl("");
        this.device = forecast.device;
        this.forecastName = forecast.id; // Use the forecast ID as the name
        this.date = forecast.date;

        // Fetch status from the service to ensure it's up-to-date
        this.getModelStatus();
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
          model.date.toLowerCase().includes(searchTerm)
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

  openEditModelDialog(): void {
    if (!this.trueId) {
      console.error("No model ID available for editing");
      return;
    }

    // Fetch the current forecast data for editing
    this.forecastService.getForecast(this.trueId).subscribe(
      (forecastData) => {
        console.log("Raw forecast data from service:", forecastData);

        // Prepare the data structure that the dialog expects
        const dialogData = {
          isEdit: true,
          forecastData: {
            trueId: forecastData.id.id,
            modelName: forecastData.name || forecastData.id.id.split("-")[0],
            device: this.device,
            deviceId: forecastData.deviceId,
            attributes: forecastData.attributes || [],
            attributesText: forecastData.attributes
              ? forecastData.attributes.map((attr) => attr.key).join(", ")
              : "",
            forecastAlgorithm: forecastData.forecastAlgorithm,
            anomalyAlgorithm: forecastData.anomalyAlgorithm,
            forecastStartDate: forecastData.forecastStartDate,
            forecastEndDate: forecastData.forecastEndDate,
            anomaliesStartDate: forecastData.anomalyStartDate,
            anomaliesEndDate: forecastData.anomalyEndDate,
          },
        };

        console.log("Opening edit dialog with data:", dialogData);

        const dialogRef = this.dialog.open(AddForecastDialogComponent, {
          width: "600px",
          data: dialogData,
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result) {
            this.updateForecast(result);
          }
        });
      },
      (error) => {
        console.error("Error fetching forecast data for editing:", error);
      }
    );
  }

  updateForecast(forecastData: any): void {
    this.forecastService.updateForecast(forecastData).subscribe(
      (response) => {
        console.log("Forecast updated successfully:", response);
        // Refresh the current model to reflect changes
        this.refreshModel();
      },
      (error) => {
        console.error("Error updating forecast:", error);
      }
    );
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

  refreshModel(): void {
    // Refresh the current forecast model data and status
    if (this.trueId) {
      this.fetchForcast(this.trueId);
      this.getModelStatus();
    }
  }

  getModelStatus(): void {
    // Fetch the model status from the backend
    if (this.trueId) {
      this.forecastService.getForecastStatus(this.trueId).subscribe(
        (response) => {
          console.log("Model status fetched:", response);
          this.status = response.status;
        },
        (error) => {
          console.error("Error fetching model status:", error);
          // Default to inactive if status fetch fails
          this.status = "inactive";
        }
      );
    }
  }

  activateModel(): void {
    // Activate the current forecast model
    if (this.trueId) {
      this.forecastService.activateForecast(this.trueId).subscribe(
        () => {
          console.log("Forecast activated successfully");
          // Fetch the updated status from backend
          this.getModelStatus();
        },
        (error) => {
          console.error("Error activating forecast:", error);
          // Handle error appropriately (show toast, alert, etc.)
        }
      );
    }
  }

  // Methods to toggle collapse/expand states
  toggleForecastChart(): void {
    this.forecastChartCollapsed = !this.forecastChartCollapsed;
    this.saveCollapsedStates();
  }

  toggleAnomalies(): void {
    this.anomaliesCollapsed = !this.anomaliesCollapsed;
    this.saveCollapsedStates();
  }

  // Methods to persist collapsed states
  private loadCollapsedStates(): void {
    try {
      const savedStates = localStorage.getItem(
        "forecast-dashboard-collapsed-states"
      );
      if (savedStates) {
        const states = JSON.parse(savedStates);
        this.forecastChartCollapsed = states.forecastChartCollapsed || false;
        this.anomaliesCollapsed = states.anomaliesCollapsed || false;
      }
    } catch (error) {
      console.warn("Error loading collapsed states:", error);
    }

    // Load view preferences from forecast model
    this.loadViewPreferences();
  }

  private saveCollapsedStates(): void {
    try {
      const states = {
        forecastChartCollapsed: this.forecastChartCollapsed,
        anomaliesCollapsed: this.anomaliesCollapsed,
      };
      localStorage.setItem(
        "forecast-dashboard-collapsed-states",
        JSON.stringify(states)
      );
    } catch (error) {
      console.warn("Error saving collapsed states:", error);
    }
  }

  // View selector methods
  toggleViewSelector(): void {
    this.showViewSelector = !this.showViewSelector;
  }

  selectView(viewValues: ForecastViewType[]): void {
    this.selectedViews = viewValues;
    this.showViewSelector = false;
    this.saveViewPreferences();
  }

  isViewSelected(viewType: ForecastViewType): boolean {
    return this.selectedViews.includes(viewType);
  }

  toggleView(viewType: ForecastViewType, checked: boolean): void {
    if (checked) {
      if (!this.selectedViews.includes(viewType)) {
        this.selectedViews.push(viewType);
      }
    } else {
      this.selectedViews = this.selectedViews.filter((v) => v !== viewType);
    }
    this.saveViewPreferences();
  }

  getCurrentViewLabel(): string {
    if (this.selectedViews.length === 2) {
      return "Both Views";
    } else if (this.selectedViews.includes(ForecastViewType.FORECAST)) {
      return "Forecast Only";
    } else if (this.selectedViews.includes(ForecastViewType.ANOMALIES)) {
      return "Anomalies Only";
    }
    return "No Views Selected";
  }

  shouldShowForecastChart(): boolean {
    return this.selectedViews.includes(ForecastViewType.FORECAST);
  }

  shouldShowAnomalies(): boolean {
    return this.selectedViews.includes(ForecastViewType.ANOMALIES);
  }

  private loadViewPreferences(): void {
    if (!this.trueId) return;

    // Load view preferences from forecast entity
    this.forecastService.getForecast(this.trueId).subscribe(
      (forecast) => {
        const preferences = parseForecastViewPreferences(
          forecast.viewPreferences || ""
        );
        this.selectedViews = preferences.selectedViews;
      },
      (error) => {
        console.warn(
          "Error loading forecast data for view preferences:",
          error
        );
        this.selectedViews = [
          ForecastViewType.FORECAST,
          ForecastViewType.ANOMALIES,
        ]; // Default fallback
      }
    );
  }

  private saveViewPreferences(): void {
    if (!this.trueId) return;

    // Get the current forecast data and update the view preferences
    this.forecastService.getForecast(this.trueId).subscribe(
      (forecast) => {
        const preferences: ForecastViewPreferences = {
          selectedViews: this.selectedViews,
        };

        // Update the forecast with new view preferences
        const updatedForecast = {
          ...forecast,
          viewPreferences: stringifyForecastViewPreferences(preferences),
        };

        // Save the updated forecast
        this.forecastService.updateForecast(updatedForecast).subscribe(
          (response) => {
            console.log(
              "View preferences saved successfully to database for forecast:",
              this.trueId
            );
          },
          (error) => {
            console.error("Error saving view preferences to database:", error);
            // Fallback to localStorage if database save fails
            this.fallbackToLocalStorage();
          }
        );
      },
      (error) => {
        console.error(
          "Error loading forecast for view preferences save:",
          error
        );
        // Fallback to localStorage if forecast load fails
        this.fallbackToLocalStorage();
      }
    );
  }

  private fallbackToLocalStorage(): void {
    try {
      const preferences: ForecastViewPreferences = {
        selectedViews: this.selectedViews,
      };
      localStorage.setItem(
        `forecast-view-${this.trueId}`,
        stringifyForecastViewPreferences(preferences)
      );
      console.log(
        "View preferences saved to localStorage as fallback for forecast:",
        this.trueId
      );
    } catch (error) {
      console.error(
        "Error saving view preferences to localStorage fallback:",
        error
      );
    }
  }

  // Document click listener for closing dropdown
  private addDocumentClickListener(): void {
    document.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;
      const viewSelectorButton = target.closest(".view-selector-button");
      const viewSelectorDropdown = target.closest(".view-selector-dropdown");

      if (
        !viewSelectorButton &&
        !viewSelectorDropdown &&
        this.showViewSelector
      ) {
        this.showViewSelector = false;
      }
    });
  }

  // Forecast status helper methods
  getForecastStatusDisplayText(status: string | boolean): string {
    const forecastStatus = getForecastStatusFromString(status);
    switch (forecastStatus) {
      case ForecastStatus.ACTIVE:
        return this.translate.instant("forecast.status.active");
      case ForecastStatus.PENDING:
        return this.translate.instant("forecast.status.pending");
      case ForecastStatus.FAILED:
        return this.translate.instant("forecast.status.failed");
      case ForecastStatus.INACTIVE:
      default:
        return this.translate.instant("forecast.status.inactive");
    }
  }

  getForecastStatusClass(status: string | boolean): string {
    const forecastStatus = getForecastStatusFromString(status);
    switch (forecastStatus) {
      case ForecastStatus.ACTIVE:
        return "status-active";
      case ForecastStatus.PENDING:
        return "status-pending";
      case ForecastStatus.FAILED:
        return "status-failed";
      case ForecastStatus.INACTIVE:
      default:
        return "status-inactive";
    }
  }

  isForecastActive(): boolean {
    return isForecastActive({ status: this.status });
  }
}
