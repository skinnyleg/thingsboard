import { ViewChild } from '@angular/core';
// ...existing code...
/* eslint-disable @angular-eslint/use-lifecycle-interface */
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppState } from '@app/core/core.state';
import { PredictiveModelsService } from '@app/core/http/forecast.service';
import { DeviceService } from '@app/core/http/device.service';
import { DialogService } from '@app/core/services/dialog.service';
import { Order } from '@app/modules/home/models/predictive-maintenance.models';
import { PageComponent } from '@app/shared/public-api';
import {
  ForecastStatus,
  getForecastStatusFromString,
  getForecastStatusDisplayText,
  isForecastActive,
  getForecastViewPreferences,
  setForecastViewPreferences,
} from '@app/shared/models/forecast.models';
import {
  ForecastViewType,
  ForecastViewPreferences,
  DEFAULT_VIEW_PREFERENCES,
  parseForecastViewPreferences,
  stringifyForecastViewPreferences,
  isForecastViewSelected,
  isAnomalyViewSelected,
} from '@app/shared/models/forecast-view-preferences.models';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import {
  AddModelDialogComponent
} from '../../../components/predictive-maintenance/components/model/add-model-dialog/add-model-dialog.component';
import { ModelSelectionDialogComponent } from './model-selection-dialog/model-selection-dialog.component';
import { ModelLogsDialogComponent } from './model-logs-dialog/model-logs-dialog.component';
import { AnomaliesComponent, AnomalyReport } from '../../../components/predictive-maintenance/components/anomalies/anomalies.component';
import { CommonModule } from '@angular/common';
import { ForecastChartComponent } from '../../../components/predictive-maintenance/components/forecast-chart/forecast-chart.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';
import { ModelWebSocketService } from '@app/core/http/model-websocket.service';

@Component({
  selector: 'tb-forecast',
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
  templateUrl: './model.component.html',
  styleUrls: ['./model.component.scss'],
  animations: [
    trigger('slideCollapse', [
      state(
        'expanded',
        style({ height: '*', opacity: 1, overflow: 'visible' })
      ),
      state(
        'collapsed',
        style({ height: '0', opacity: 0, overflow: 'hidden' })
      ),
      transition(
        'expanded <=> collapsed',
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ),
    ]),
  ],
})
export class ModelComponent extends PageComponent implements Order {
  // Reference to the anomalies table component
  @ViewChild(AnomaliesComponent) anomaliesComponent?: AnomaliesComponent;

  deviceId: string; // To pass to the chart

  Attributes: string[]; // To store the temperature data

  forecastData: Order[];

  models: Order[];

  filteredModels: Order[] = []; // For storing filtered models

  modelSearchTerm = ''; // Search term for filtering models

  modelNames: Map<string, string> = new Map(); // Cache for model names

  id: string;

  trueId: string;

  device: string;

  forecastName: string;

  date: string;

  status = 'inactive';

  // Collapse/expand states for charts
  forecastChartCollapsed = false;

  anomaliesCollapsed = false;

  // View selector options
  viewOptions = [
    {
      value: ForecastViewType.FORECAST,
      label: 'Show Forecast',
      icon: 'trending_up',
    },
    {
      value: ForecastViewType.ANOMALIES,
      label: 'Show Anomalies',
      icon: 'bug_report',
    },
  ];

  selectedViews: ForecastViewType[] = [
    ForecastViewType.FORECAST,
    ForecastViewType.ANOMALIES,
  ];

  showViewSelector = false;

  unreadLogs = false;

  constructor(
    protected store: Store<AppState>,
    protected route: ActivatedRoute,
    private predictiveModelsService: PredictiveModelsService,
    private deviceService: DeviceService,
    protected router: Router,
    public dialog: MatDialog,
    private translate: TranslateService,
    private modelWebSocketService: ModelWebSocketService,
    private dialogService: DialogService,
  ) {
    super(store);
  }

  ngOnDestroy(): void {
    // Unsubscribe from job status updates
    if (this.trueId) {
      this.modelWebSocketService.unsubscribeFromJobStatus(this.trueId, 'anomaly');
    }
    this.modelWebSocketService.disconnect();
  }

  changeModel(value: any) {
    this.router.navigateByUrl('/predictiveMaintenance/model/' + value);

    this.deviceId = '';
    this.Attributes = [];
    this.trueId = value;
    this.fetchPredictiveModelConfig(value);
  }

  openModelSelectionDialog(): void {
    const dialogRef = this.dialog.open(ModelSelectionDialogComponent, {
      width: '600px',
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
      console.error('No forecast data passed.');
    }

    // Load collapsed states from localStorage
    this.loadCollapsedStates();

    // Add document click listener for view selector dropdown
    this.addDocumentClickListener();

    this.modelWebSocketService.connect();
    // Update anomalies component about connection status (if available)
    try {
      // const connected = this.modelWebSocketService.isConnected();
      // this.anomaliesComponent?.setStreamStatus(connected, connected ? null : null);
    } catch (e) {
      // ignore if service is not ready
    }
    // Ensure we update anomalies component when the WebSocket actually connects
    this.modelWebSocketService.onConnect(() => {
      try {
        // const connected = this.modelWebSocketService.isConnected();
        // this.anomaliesComponent?.setStreamStatus(connected, connected ? null : null);
      } catch (e) {
        // ignore
      }
    });

    this.init();
  }

  ngAfterViewInit(): void {
    // set 3 random anomalies for testing
        // const testAnomalies: AnomalyReport[] = [
        //   {
        //     id: '1',
        //     reportEntity: this.deviceId,
        //     errorName: 'Overheat',
        //     severity: 'Critical',
        //     creationDate: new Date().toISOString(),
        //     componentType: 'Engine',
        //     deviceType: 'Type A',
        //     location: 'Factory 1',
        //     description: 'Engine temperature exceeded threshold',
        //     status: 'Active',
        //     affectedMetrics: ['temperature'],
        //     confidence: 95,
        //     timeRange: '2024-10-01 10:00 - 2024-10-01 10:30'
        //   },
        //   {
        //     id: '2',
        //     reportEntity: this.deviceId,
        //     errorName: 'Vibration Alert',
        //     severity: 'Major',
        //     creationDate: new Date().toISOString(),
        //     componentType: 'Motor',
        //     deviceType: 'Type B',
        //     location: 'Factory 2',
        //     description: 'Unusual vibration patterns detected',
        //     status: 'Investigating',
        //     affectedMetrics: ['vibration'],
        //     confidence: 85,
        //     timeRange: '2024-10-02 14:00 - 2024-10-02 14:45'
        //   }
        // ];

        // testAnomalies.forEach((a) => {
        //   // console.log('Adding test anomaly:', a);
        //   this.anomaliesComponent.addAnomaly(a);
        //   if (this.anomaliesComponent) {
        //   }
        // });
  }

  private init() {
    this.route.params.subscribe((params) => {
      // console.log('Route params:', params);
      if (params.id) {
        this.id = params.id;
        this.fetchPredictiveModelConfig(params.id);
        this.models = this.forecastData;
        // console.log("models === ", this.models);
        if (this.models === undefined || this.models.length === 0) {
          return this.router.navigateByUrl('/predictiveMaintenance');
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
        if (!forecast) {
          return this.router.navigateByUrl('');
        }
        this.device = forecast.device;
        this.forecastName = forecast.id; // Use the forecast ID as the name
        this.date = forecast.date;

        this.modelWebSocketService.cleanUp();

        // Subscribe to job logs
        this.modelWebSocketService.requestJobLogs(this.trueId).subscribe((msg) => {
            // console.log('Log message received:', msg);
            msg.data.logs.forEach(log => {
              console.log('Log entry:', log);
              if (log.level.toLowerCase() === 'prediction') {
                console.log('Job prediction:', log.message);
                // Try to parse prediction log as JSON

                if (typeof log.message !== 'string') {
                  const anomalies: AnomalyReport[] = log.message?.result?.filter((result) =>

                  result.failure_predicted === true

                  ).map((result: any) => {
                    const confidence = result.general_failure_probability ? Math.round(result.general_failure_probability * 100) : 0;
                    const severity = confidence >= 90 ? 'Critical' : confidence >= 70 ? 'Major' : 'Minor';

                    // Normalize timeRange -> startTime/endTime if possible
                    let startTime: string | number | undefined;
                    let endTime: string | number | undefined;
                    if (result.datetime) {
                      const parts = (result.datetime || '').toString().split('/');
                      if (parts.length === 2) {
                        startTime = parts[0];
                        endTime = parts[1];
                      } else {
                        startTime = result.datetime;
                        endTime = result.datetime;
                      }
                    }

                    return {
                      timeRange: result.datetime || '',
                      startTime,
                      endTime,
                      confidence,
                      affectedMetrics: result.predicted_failing_component ? [result.predicted_failing_component] : [],
                      componentFailureProbabilities: result.component_failure_probabilities || {},
                      componentProbabilities: result.component_probabilities || {},
                      id: result.id || `${this.trueId || 'forecast'}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                      reportEntity: this.deviceId,
                      errorName: result.predicted_failing_component || 'Unknown',
                      severity,
                      creationDate: result.datetime || new Date().toISOString(),
                      componentType: result.predicted_failing_component || 'Unknown',
                      deviceType: 'Unknown',
                      location: 'Unknown',
                      description: 'Predicted failure for component ' + (result.predicted_failing_component || 'Unknown'),
                      status: 'Active',
                    };
                  }) || [];
                  this.anomaliesComponent.updateAnomalies(anomalies || []);
                }

              } else {
                // console.log4('Job log:', log.message);
              }
            });
            // msg?..forEach((log: AnomalyLogs) => {
            // if (log.type === 'prediction') {
            //   console.log('Job prediction:', log.message);
            // } else {
            //   console.log('Job log:', log.message);
            // }
          // });
        }, (err) => {
          console.error('Error receiving job logs:', err);
          this.anomaliesComponent?.setStreamStatus(false, 'Error receiving job logs');
        });

        // Subscribe to real-time job status updates
  this.modelWebSocketService.subscribeToJobStatus(this.trueId, 'anomaly').subscribe((msg: any) => {
          // if (msg.type === 'prediction') {
          //   console.log('Job prediction:', msg.data.logs);
          // } else {
          //   console.log('Job status message received:', msg);
          // }
          if (msg?.data) {
            this.currentIteration = msg.data.iteration || 0;
            this.jobStatus = msg.data.status;
              this.lastRunTime = msg.data.last_run;

              // Update main status if job is running (ensure it's a string)
              // if (this.jobStatus === 'running') {
              //   this.status = 'active';
              // } else if (this.jobStatus === 'stopped' || this.jobStatus === 'not_found') {
              //   this.status = 'inactive';
              // }
              if (msg.data.model_exists) {
                this.status = 'active';
                this.anomaliesComponent.setStreamStatus(true, null);
              } else {
                this.status = 'inactive';
              }
            }
        }, (err) => {
          console.error('Error subscribing to job status:', err);
          this.anomaliesComponent?.setStreamStatus(false, 'Error subscribing to job status');
        });

        // Fetch status from the service to ensure it's up-to-date
        // this.getModelStatus();
      }
    });
  }

  private fetchModelNames() {
    if (this.models && this.models.length > 0) {
      this.models.forEach((model) => {
        this.predictiveModelsService.getPredictiveModel(model.trueId).subscribe(
          (data) => {
            const name = data.name || data.id.id.split('-')[0];
            this.modelNames.set(model.trueId, name);
            // Update filtered models after names are fetched
            this.filterModels();
          },
          (error) => {
            console.error(
              'Error fetching forecast name for',
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
    if (!this.modelSearchTerm || this.modelSearchTerm.trim() === '') {
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
    this.modelSearchTerm = ''; // Reset search term when models change
  }

  fetchPredictiveModelConfig(forecastId: string): any {
    this.predictiveModelsService.getPredictiveModel(forecastId).subscribe(
      (data) => {
        this.deviceId = data.deviceId.id;
        this.Attributes = data.attributes.map((attr) => attr.key);
        this.trueId = data.id.id;
        this.forecastName = data.name || data.id.id.split('-')[0]; // Use name if available, fallback to ID

        // Fetch device name
        this.deviceService.getDevice(data.deviceId.id).subscribe(
          (device) => {
            this.device = device.name;
          },
          (error) => {
            console.error('Error fetching device:', error);
            this.device = data.deviceId.id; // Fallback to device ID
          }
        );
      },
      (error) => {
        console.error('Error fetching forecast:', error);
      }
    );
  }

  openCreateModelDialog(): void {
    const dialogRef = this.dialog.open(AddModelDialogComponent, {
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addForecast(result); // Call addForecast if a result is returned
      }
    });
  }

  openLogsDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for viewing logs');
      return;
    }

    const dialogRef = this.dialog.open(ModelLogsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      height: '80vh',
      data: {
        modelId: this.trueId,
        modelName: this.forecastName || this.trueId,
        deviceId: this.deviceId,
        websocket: null,
        wsUrl: '',
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      // console.log('Logs dialog closed');
    });
  }

  openForecastLogsDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for viewing forecast logs');
      return;
    }

    const dialogRef = this.dialog.open(ModelLogsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      height: '80vh',
      data: {
        modelId: this.trueId,
        modelName: this.forecastName || this.trueId,
        deviceId: this.deviceId,
        modelTypeFilter: 'forecast',
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      // console.log('Forecast logs dialog closed');
    });
  }

  openAnomalyLogsDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for viewing anomaly logs');
      return;
    }

    const dialogRef = this.dialog.open(ModelLogsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      height: '80vh',
      data: {
        modelId: this.trueId,
        modelName: this.forecastName || this.trueId,
        deviceId: this.deviceId,
        modelTypeFilter: 'anomaly',
      },
    });

    dialogRef.afterClosed().subscribe(() => {
      // console.log('Anomaly logs dialog closed');
    });
  }

  openEditModelDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for editing');
      return;
    }

    // Fetch the current forecast data for editing
    this.predictiveModelsService.getPredictiveModel(this.trueId).subscribe(
      (forecastData) => {
        // console.log('Raw forecast data from service:', forecastData);

        // Prepare the data structure that the dialog expects
        const dialogData = {
          isEdit: true,
          forecastData: {
            trueId: forecastData.id.id,
            modelName: forecastData.name || forecastData.id.id.split('-')[0],
            device: this.device,
            deviceId: forecastData.deviceId,
            attributes: forecastData.attributes || [],
            attributesText: forecastData.attributes
              ? forecastData.attributes.map((attr) => attr.key).join(', ')
              : '',
            forecastAlgorithm: forecastData.forecastAlgorithm,
            anomalyAlgorithm: forecastData.anomalyAlgorithm,
            forecastStartDate: forecastData.forecastStartDate,
            forecastEndDate: forecastData.forecastEndDate,
            anomaliesStartDate: forecastData.anomalyStartDate,
            anomaliesEndDate: forecastData.anomalyEndDate,
          },
        };

        // console.log('Opening edit dialog with data:', dialogData);

        const dialogRef = this.dialog.open(AddModelDialogComponent, {
          width: '600px',
          data: dialogData,
        });

        dialogRef.afterClosed().subscribe((result) => {
          if (result) {
            this.updateForecast(result);
          }
        });
      },
      (error) => {
        console.error('Error fetching forecast data for editing:', error);
      }
    );
  }

  updateForecast(forecastData: any): void {
    this.predictiveModelsService.updatePredictiveModel(forecastData).subscribe(
      (response) => {
        // console.log('Forecast updated successfully:', response);
        // Refresh the current model to reflect changes
        this.refreshModel();
      },
      (error) => {
        console.error('Error updating forecast:', error);
      }
    );
  }

  deleteModel(): void {
    if (!this.trueId) {
      console.error('No model ID available for deletion');
      return;
    }

    const modelName = this.getModelDisplayName(this.models.find(m => m.trueId === this.trueId));

    this.dialogService.confirm(
      this.translate.instant('forecast.delete-model-title'),
      this.translate.instant('forecast.delete-model-text', { modelName }),
      this.translate.instant('action.no'),
      this.translate.instant('action.yes'),
      true
    ).subscribe((result) => {
      if (result) {
        this.predictiveModelsService.deletePredictiveModel(this.trueId).subscribe(
          () => {
            // console.log('Model deleted successfully');
            // Navigate back to predictive maintenance page
            this.router.navigate(['/predictiveMaintenance']);
          },
          (error) => {
            console.error('Error deleting model:', error);
          }
        );
      }
    });
  }

  addForecast(forecast: any): void {
    // Call the service to add a forecast
    this.predictiveModelsService.addPredictiveModelConfig(forecast).subscribe(
      (response) => {
        // console.log('Forecast created successfully:', response);
        // Navigate back to the forecast list to see the new model
        this.router.navigateByUrl('/PM');
      },
      (error) => {
        console.error('Error adding forecast:', error);
      }
    );
  }

  refreshModel(): void {
    // Refresh the current forecast model data and status
    if (this.trueId) {
      this.fetchPredictiveModelConfig(this.trueId);
      // this.getModelStatus();
    }
  }

  // getModelStatus(): void {
  //   // Fetch the model status from the backend
  //   if (this.trueId) {
  //     this.predictiveModelsService.getPredictiveModelStatus(this.trueId).subscribe(
  //       (response) => {
  //         console.log('Model status fetched:', response);
  //         this.status = response.status;
  //       },
  //       (error) => {
  //         console.error('Error fetching model status:', error);
  //         // Default to inactive if status fetch fails
  //         this.status = 'inactive';
  //       }
  //     );
  //   }
  // }


  activationProgress = '';

  activationComplete = false;

  predictions: any = null;

  logs: string[] = [];

  isWsConnected = false;

  progressMessage: { step: string; progress: number } | null = null;

  currentIteration = 0;

  lastRunTime: string | null = null;

  jobStatus: 'running' | 'stopped' | 'not_found' | null = null;

  activateModel(): void {
    // console.log('Activating model:', this.trueId);
    if (!this.trueId) {
      return;
    }
    this.activationProgress = '';
    this.activationComplete = false;
    this.predictions = null;
    this.logs = [];
    this.progressMessage = null;
    this.modelWebSocketService.sendActivateCommand(this.trueId).subscribe((msg) => {
        this.handleWebSocketMessage(msg);
    });
  }

  private handleWebSocketMessage(msg: any): void {
    if (!msg) {
      return;
    }

    switch (msg.type) {
      case 'progress':
        // Update progress message for UI
        this.progressMessage = {
          step: msg.step || 'Processing',
          progress: msg.progress || 0
        };
        // Also update status to show pending state
        this.status = 'pending';
        break;
      case 'complete':
        // Clear progress and refresh status
        this.progressMessage = null;
        this.activationComplete = true;
        this.status = 'active';
        this.anomaliesComponent.setStreamStatus(true, null);
        // this.getModelStatus();
        break;
      case 'error':
        // Clear progress and mark as failed
        this.progressMessage = null;
        this.status = 'failed';
        break;
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
        'forecast-dashboard-collapsed-states'
      );
      if (savedStates) {
        const states = JSON.parse(savedStates);
        this.forecastChartCollapsed = states.forecastChartCollapsed || false;
        this.anomaliesCollapsed = states.anomaliesCollapsed || false;
      }
    } catch (error) {
      console.warn('Error loading collapsed states:', error);
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
        'forecast-dashboard-collapsed-states',
        JSON.stringify(states)
      );
    } catch (error) {
      console.warn('Error saving collapsed states:', error);
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
      return 'Both Views';
    } else if (this.selectedViews.includes(ForecastViewType.FORECAST)) {
      return 'Forecast Only';
    } else if (this.selectedViews.includes(ForecastViewType.ANOMALIES)) {
      return 'Anomalies Only';
    }
    return 'No Views Selected';
  }

  shouldShowForecastChart(): boolean {
    return this.selectedViews.includes(ForecastViewType.FORECAST);
  }

  shouldShowAnomalies(): boolean {
    return this.selectedViews.includes(ForecastViewType.ANOMALIES);
  }

  private loadViewPreferences(): void {
    if (!this.trueId) {
      return;
    }

    // Load view preferences from forecast entity
    this.predictiveModelsService.getPredictiveModel(this.trueId).subscribe(
      (forecast) => {
        const preferences = parseForecastViewPreferences(
          forecast.viewPreferences || ''
        );
        this.selectedViews = preferences.selectedViews;
      },
      (error) => {
        console.warn(
          'Error loading forecast data for view preferences:',
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
    if (!this.trueId) {
      return;
    }

    // Get the current forecast data and update the view preferences
    this.predictiveModelsService.getPredictiveModel(this.trueId).subscribe(
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
        this.predictiveModelsService.updatePredictiveModel(updatedForecast).subscribe(
          (response) => {
            // console.log(
            //   'View preferences saved successfully to database for forecast:',
            //   this.trueId
            // );
          },
          (error) => {
            console.error('Error saving view preferences to database:', error);
            // Fallback to localStorage if database save fails
            this.fallbackToLocalStorage();
          }
        );
      },
      (error) => {
        console.error(
          'Error loading forecast for view preferences save:',
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
      // console.log(
      //   'View preferences saved to localStorage as fallback for forecast:',
      //   this.trueId
      // );
    } catch (error) {
      console.error(
        'Error saving view preferences to localStorage fallback:',
        error
      );
    }
  }

  // Document click listener for closing dropdown
  private addDocumentClickListener(): void {
    document.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement;
      const viewSelectorButton = target.closest('.view-selector-button');
      const viewSelectorDropdown = target.closest('.view-selector-dropdown');

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
        return this.translate.instant('forecast.status.active');
      case ForecastStatus.PENDING:
        return this.translate.instant('forecast.status.pending');
      case ForecastStatus.FAILED:
        return this.translate.instant('forecast.status.failed');
      case ForecastStatus.INACTIVE:
      default:
        return this.translate.instant('forecast.status.inactive');
    }
  }

  getForecastStatusClass(status: string | boolean): string {
    const forecastStatus = getForecastStatusFromString(status);
    switch (forecastStatus) {
      case ForecastStatus.ACTIVE:
        return 'status-active';
      case ForecastStatus.PENDING:
        return 'status-pending';
      case ForecastStatus.FAILED:
        return 'status-failed';
      case ForecastStatus.INACTIVE:
      default:
        return 'status-inactive';
    }
  }

  isForecastActive(): boolean {
    return isForecastActive({ status: this.status });
  }
}
