import { ViewChild, ElementRef, ChangeDetectorRef, NgZone, Input, OnDestroy } from '@angular/core';
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
import {
  AnomaliesComponent,
  LogEntry,
  AnomalyPrediction,
  AnomalyReport,
  ForecastPredictionLogEntry,
  AnomalyPredictionLogEntry,
  ForecastPrediction,
  ForecastSensorPredictions,
  ForecastPredictionLogEntryMessage
} from '../../../components/predictive-maintenance/components/anomalies/anomalies.component';
import { CommonModule } from '@angular/common';
import { ForecastChartComponent } from '../../../components/predictive-maintenance/components/forecast-chart/forecast-chart.component';
import { TimeSeriesTelemetryComponent } from '../../../components/predictive-maintenance/components/time-series-telemetry/time-series-telemetry.component';
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
import { ModelLogsNotifierService } from './model-logs-notifier.service';
import { flatMap, result } from 'lodash';
import { mergeMap, Observable } from 'rxjs';
import { distinctUntilChanged, filter, tap } from 'rxjs/operators';

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
    TimeSeriesTelemetryComponent,
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
export class ModelComponent extends PageComponent implements Order, OnDestroy {

  // Reference to the anomalies table component
  @ViewChild(AnomaliesComponent) anomaliesComponent?: AnomaliesComponent;

  // Reference to the logs button element
  @ViewChild('logsButton', { read: ElementRef }) logsButton?: ElementRef;

  deviceId: string; // To pass to the chart

  Attributes: string[]; // To store the temperature data

  @Input() forecastData: ForecastSensorPredictions; //Order[];

  @Input() forecastMaxSteps: number; // Number of forecast points

  modelsData: Order[];

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

  forecastAlgorithm: string;

  anomalyAlgorithm: string;

  forecastGrouping = 'hourly';

  // Collapse/expand states for charts
  forecastChartCollapsed = false;

  anomaliesCollapsed = false;

  timeSeriesChartCollapsed = false;

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

  selectedViews: ForecastViewType[] = [];

  selectedSensor = 'rotate'; // Default sensor for forecast chart

  showViewSelector = false;

  unreadLogs = false;

  // Initialize unread logs state from the notifier service on component creation
  private initializeUnreadLogsState(): void {
    if (this.trueId) {
      const hasUnread = this.logsNotifier.hasUnreadLogs(this.trueId);
      console.log('Initializing unreadLogs from notifier for', this.trueId, ':', hasUnread);
      this.unreadLogs = hasUnread;
    }
  }

  // Logs tooltip properties
  showLogsTooltip = false; // Only true after calculations are complete

  dontShowLogsTooltipAgain = false;

  logsTooltipPosition = { top: -1000000, left: -1000000, zIndex: -1000 };

  private readonly LOGS_TOOLTIP_PREFERENCE_KEY = 'model-logs-tooltip-dont-show';

  // Log tracking properties
  private lastReadLogTimestamp = 0;

  private logsObservable: Observable<LogEntry> = null;

  private subscriptions: Array<any> = [];

  private notifierSubscription: any = null;

  private routeParamsSubscription: any = null;

  private readonly LAST_READ_LOG_KEY_PREFIX = 'model-last-read-log-';

  private forecastPredictionLogs$: Observable<ForecastPredictionLogEntry>;

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
    private logsNotifier: ModelLogsNotifierService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    super(store);
  }

  ngOnDestroy(): void {
    // Unsubscribe from log updates
    if (this.logsObservable) {
      // this.logsObservable.unsubscribe();
      this.logsObservable = null;
    }

    // Unsubscribe from job status updates
    if (this.trueId) {
      this.modelWebSocketService.unsubscribeFromJobStatus(this.trueId, 'anomaly');
      this.modelWebSocketService.unsubscribeFromLogs(this.trueId);
    }
    this.modelWebSocketService.disconnect();

    // Unsubscribe from notifier
    if (this.notifierSubscription) {
      this.notifierSubscription.unsubscribe();
      this.notifierSubscription = null;
    }

    // Unsubscribe from route params
    if (this.routeParamsSubscription) {
      this.routeParamsSubscription.unsubscribe();
      this.routeParamsSubscription = null;
    }

    // Unsubscribe from all tracked subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  changeModel(value: any) {
    this.router.navigateByUrl('/predictiveMaintenance/model/' + value);

    this.deviceId = '';
    this.Attributes = [];
    this.trueId = value;
    this.forecastAlgorithm = '';
    this.anomalyAlgorithm = '';
    this.forecastGrouping = 'hourly';
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
      this.modelsData = history.state.forecastData;
      // console.log("Forecast data received:", this.forecastData);
    } else {
      // Optionally, handle the case when data is not passed
      console.error('No forecast data passed.');
    }



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
    // Position the tooltip after view is initialized
    // this.displayLogsTooltip();

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

  private positionLogsTooltip(): void {
    // setTimeout(() => {
      if (this.logsButton) {
        const buttonElement = this.logsButton.nativeElement;
        const iconElement = buttonElement.querySelector('mat-icon');

        // Use the icon element's bounding box if available, otherwise fall back to button
        const rect = iconElement ? iconElement.getBoundingClientRect() : buttonElement.getBoundingClientRect();

        // Calculate tooltip position so the arrow points right after the icon (not the button container)
        this.logsTooltipPosition = {
          top: rect.bottom + 14, // 2px below the icon itself
          left: rect.left + (rect.width / 2), // Align arrow with center of icon
          zIndex: 1000 // Ensure tooltip is above other elements
        };

        // Only show tooltip after calculations are complete (for testing purposes)
        // this.showLogsTooltip = true;
      }
    // }, 200); // Increased timeout to ensure UI is stable
  }

  private init() {
    // Track route params subscription for proper cleanup
    this.routeParamsSubscription = this.route.params.pipe(
  distinctUntilChanged((prev, curr) => prev.id === curr.id)
).subscribe((params) => {
      // console.log('Route params:', params);
      if (params.id) {
        this.trueId = params.id;
        this.id = params.id;
        this.fetchPredictiveModelConfig(params.id);
        this.models = this.modelsData;
        // console.log("models === ", this.models);
        if (this.models === undefined || this.models.length === 0) {
          return this.router.navigateByUrl('/predictiveMaintenance');
        }

        // Load collapsed states from localStorage
        this.loadCollapsedStates();

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

        // Load last read log timestamp from localStorage
        this.loadLastReadLogTimestamp();
        console.log('Initial lastReadLogTimestamp for model', this.trueId, ':', this.lastReadLogTimestamp);

        // Initialize unread logs state from notifier service
        this.initializeUnreadLogsState();
        console.log('Initial unreadLogs after initialization:', this.unreadLogs);

        // Clean up previous subscriptions before creating new ones
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions = [];

        // map job logs to each log entry
        this.logsObservable = this.modelWebSocketService.requestJobLogs(this.trueId)
        .pipe(
          mergeMap((msg) => flatMap(msg.data.logs)),
          tap((log) => {
            console.log('%cReceived log entry:', 'color: green;', log);
          }),
        );

        // this.subscriptions.push(this.logsObservable.subscribe((log) => {
        //   console.log('Log entry:', log);
        // }));

        // const anomalyPredictionLogs$ = this.logsObservable.pipe(
        //   filter((log: LogEntry) =>
        //     log.type && log.type.toLowerCase() === 'anomaly' && log.level && log.level.toLowerCase() === 'prediction')
        // ) as Observable<AnomalyPredictionLogEntry>;

        // anomalyPredictionLogs$.subscribe(log => {
        //       // console.log('Log entry:', log);
        //       console.log('Anomaly Prediction Log entry:', log);

        //       // Check if this log is new (after last read timestamp)
        //       const logTimestamp = log.timestamp ? new Date(log.timestamp).getTime() : Date.now();
        //       console.log(
        //         'Log timestamp:',
        //         logTimestamp,
        //         'Last read:',
        //         this.lastReadLogTimestamp,
        //         'Is new?',
        //         logTimestamp > this.lastReadLogTimestamp
        //       );
        //       if (logTimestamp > this.lastReadLogTimestamp) {
        //         console.log('Setting unreadLogs to true');
        //         // Run inside Angular zone to ensure change detection
        //         this.ngZone.run(() => {
        //           this.unreadLogs = true;
        //           console.log('Inside zone, unreadLogs set to:', this.unreadLogs);
        //         });
        //         console.log('After zone.run, unreadLogs:', this.unreadLogs);
        //         // update global notifier
        //         try {
        //           if (this.trueId) {
        //             this.logsNotifier.setUnread(this.trueId, true);
        //           }
        //         } catch (e) {
        //           // ignore notifier errors
        //         }
        //       }

        //       if (log.level.toLowerCase() === 'prediction') {
        //         console.log('Job prediction:', log.message);
        //         // Try to parse prediction log as JSON

        //         if (typeof log.message !== 'string') {
        //           const anomalies: AnomalyReport[] = log.message?.result?.filter((result) =>

        //           result.failure_predicted === true

        //           ).map((result: any) => {
        //             const confidence = result.general_failure_probability ? Math.round(result.general_failure_probability * 100) : 0;
        //             const severity = confidence >= 90 ? 'Critical' : confidence >= 70 ? 'Major' : 'Minor';

        //             // Normalize timeRange -> startTime/endTime if possible
        //             let startTime: string | number | undefined;
        //             let endTime: string | number | undefined;
        //             if (result.datetime) {
        //               const parts = (result.datetime || '').toString().split('/');
        //               if (parts.length === 2) {
        //                 startTime = parts[0];
        //                 endTime = parts[1];
        //               } else {
        //                 startTime = result.datetime;
        //                 endTime = result.datetime;
        //               }
        //             }

        //             return {
        //               timeRange: result.datetime || '',
        //               startTime,
        //               endTime,
        //               confidence,
        //               affectedMetrics: result.predicted_failing_component ? [result.predicted_failing_component] : [],
        //               componentFailureProbabilities: result.component_failure_probabilities || {},
        //               componentProbabilities: result.component_probabilities || {},
        //               id: result.id || `${this.trueId || 'forecast'}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        //               reportEntity: this.deviceId,
        //               errorName: result.predicted_failing_component || 'Unknown',
        //               severity,
        //               creationDate: result.datetime || new Date().toISOString(),
        //               componentType: result.predicted_failing_component || 'Unknown',
        //               deviceType: 'Unknown',
        //               location: 'Unknown',
        //               description: 'Predicted failure for component ' + (result.predicted_failing_component || 'Unknown'),
        //               status: 'Active',
        //             };
        //           }) || [];
        //           this.anomaliesComponent.updateAnomalies(anomalies || []);
        //         }

        //       } else {
        //         // console.log4('Job log:', log.message);
        //       }
        //     });

        this.forecastPredictionLogs$ = this.logsObservable.pipe(
          filter((log: LogEntry) =>
            log.level && log.level.toLowerCase() === 'prediction' &&
          (log.type && log.type.toLowerCase() === 'forecast') || (log.source && log.source.toLowerCase() === 'forecastmodel'))
        ) as Observable<ForecastPredictionLogEntry>;

        this.subscriptions.push(
          this.forecastPredictionLogs$.subscribe(log => {
          console.log('Forecast Prediction Log entry:', log);

          let results: ForecastPrediction = null;

          // Safely parse log message - it could be JSON or plain text
          if (typeof log.message === 'string') {
            try {
              results = JSON.parse(log.message);
            } catch (e) {
              // Message is plain text, not JSON - skip processing
              console.log('Non-JSON log message:', log.message);
              return;
            }
          } else {
            results = log.message.result as ForecastPrediction;
          }

          console.log({
            results
          });
            // check if

          if (results) {
            const forecast_max_steps = results.forecast_max_steps;

            // Store forecast_max_steps for display in chart toolbar
            this.forecastMaxSteps = forecast_max_steps;

            delete results.forecast_max_steps;

            const data = results as ForecastSensorPredictions;

            // Run inside Angular zone to trigger change detection
            this.ngZone.run(() => {
              this.forecastData = data;
              // Force change detection
              this.cdr.detectChanges();
              console.log('Forecast data updated:', this.forecastData);
            });
          }
        }));
        // Subscribe to real-time job status updates
        this.subscriptions.push(this.modelWebSocketService.subscribeToJobStatus(this.trueId, 'anomaly').subscribe((msg: any) => {
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
                // this.status = 'active';
                this.status = 'inactive';
                this.anomaliesComponent.setStreamStatus(true, null);
              } else {
                this.status = 'inactive';
              }
            }
        }, (err) => {
          console.error('Error subscribing to job status:', err);
          this.anomaliesComponent?.setStreamStatus(false, 'Error subscribing to job status');
        }));

        // Fetch status from the service to ensure it's up-to-date
        // this.getModelStatus();
      }

      // Clean up previous notifier subscription before creating new one
      if (this.notifierSubscription) {
        this.notifierSubscription.unsubscribe();
        this.notifierSubscription = null;
      }

      // Subscribe to notifier changes so the UI updates if other parts mark read
      this.notifierSubscription = this.logsNotifier.changes().subscribe(change => {
        if (change.modelId === this.trueId) {
          this.ngZone.run(() => {
            this.unreadLogs = change.unread;
            console.log('Notifier changed unreadLogs to:', this.unreadLogs, 'for model:', this.trueId);
          });
        }
      });
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
        this.forecastAlgorithm = data.forecastAlgorithm;
        this.anomalyAlgorithm = data.anomalyAlgorithm;
        this.forecastGrouping = JSON.parse(data.additionalData || '{}').forecastGrouping || 'hourly';

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

    // eslint-disable-next-line @typescript-eslint/no-shadow
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

    // Mark logs as read when opening the dialog
    this.unreadLogs = false;
    this.saveLastReadLogTimestamp();
    try {
      if (this.trueId) {
        this.logsNotifier.markAsRead(this.trueId);
      }
    } catch (e) {
      // ignore
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

  openForecastStatsDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for viewing forecast stats');
      return;
    }

    // TODO: Create ModelStatsDialogComponent
    // For now, show a placeholder dialog with model info
    this.dialogService.alert(
      'Forecast Training Stats',
      `<div style="text-align: left;">
        <p><strong>Model ID:</strong> ${this.trueId}</p>
        <p><strong>Model Name:</strong> ${this.forecastName || 'N/A'}</p>
        <p><strong>Algorithm:</strong> ${this.forecastAlgorithm || 'N/A'}</p>
        <p><strong>Device:</strong> ${this.device || 'N/A'}</p>
        <p><strong>Status:</strong> ${this.status || 'N/A'}</p>
        <hr>
        <p><em>Training stats dialog will show:</em></p>
        <ul>
          <li>Algorithm used</li>
          <li>Training period</li>
          <li>Model performance metrics</li>
          <li>Training duration</li>
          <li>Hyperparameters</li>
        </ul>
      </div>`,
      'Close',
      true
    );
  }

  openAnomalyStatsDialog(): void {
    if (!this.trueId) {
      console.error('No model ID available for viewing anomaly stats');
      return;
    }

    // TODO: Create ModelStatsDialogComponent
    // For now, show a placeholder dialog with model info
    this.dialogService.alert(
      'Anomaly Training Stats',
      `<div style="text-align: left;">
        <p><strong>Model ID:</strong> ${this.trueId}</p>
        <p><strong>Model Name:</strong> ${this.forecastName || 'N/A'}</p>
        <p><strong>Algorithm:</strong> ${this.anomalyAlgorithm || 'N/A'}</p>
        <p><strong>Device:</strong> ${this.device || 'N/A'}</p>
        <p><strong>Status:</strong> ${this.status || 'N/A'}</p>
        <hr>
        <p><em>Training stats dialog will show:</em></p>
        <ul>
          <li>Algorithm used</li>
          <li>Training period</li>
          <li>Model performance metrics</li>
          <li>Training duration</li>
          <li>Hyperparameters</li>
        </ul>
      </div>`,
      'Close',
      true
    );
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

        const forecastGrouping = JSON.parse(forecastData.additionalData || '{}').forecastGrouping || 'hourly';

        // Prepare the data structure that the dialog expects
        const dialogData = {
          isEdit: true,
          forecastData: {
            id: forecastData.id, // Include the full ForecastId object
            trueId: forecastData.id,
            modelName: forecastData.name || forecastData.id.id.split('-')[0],
            device: this.device,
            deviceId: forecastData.deviceId,
            attributes: forecastData.attributes || [],
            attributesText: forecastData.attributes
              ? forecastData.attributes.map((attr) => attr.key).join(', ')
              : '',
            forecastAlgorithm: forecastData.forecastAlgorithm,
            anomalyAlgorithm: forecastData.anomalyAlgorithm,
            forecastGrouping,
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

        // eslint-disable-next-line @typescript-eslint/no-shadow
        dialogRef.afterClosed().subscribe((result) => {
          if (result) {
            // Check if result contains needsRebuild flag (edit mode format)
            if (result.forecastData !== undefined && result.needsRebuild !== undefined) {
              if (result.needsRebuild) {
                // Show confirmation dialog for rebuild
                this.dialogService.confirm(
                  this.translate.instant('forecast.rebuild-model-title'),
                  this.translate.instant('forecast.rebuild-model-text'),
                  this.translate.instant('action.cancel'),
                  this.translate.instant('forecast.rebuild'),
                  true
                ).subscribe((confirmed) => {
                  if (confirmed) {
                    // User confirmed rebuild
                    this.updateForecast(result.forecastData, true);
                  } else {
                    // User cancelled, just close without updating
                    console.log('Model rebuild cancelled by user');
                  }
                });
              } else {
                // No significant changes, just update without rebuild
                this.updateForecast(result.forecastData, false);
              }
            } else {
              // Shouldn't happen in edit mode, but handle it gracefully
              console.warn('Unexpected result format from edit dialog:', result);
              this.updateForecast(result, false);
            }
          }
        });
      },
      (error) => {
        console.error('Error fetching forecast data for editing:', error);
      }
    );
  }

  updateForecast(forecastData: any, shouldRebuild: boolean): void {
    this.predictiveModelsService.updatePredictiveModel(forecastData).subscribe(
      (response) => {
        console.log('Forecast updated successfully:', response);

        // Update algorithm labels immediately from the saved data
        this.forecastAlgorithm = forecastData.forecastAlgorithm;
        this.anomalyAlgorithm = forecastData.anomalyAlgorithm;

        // If rebuild was requested, trigger activate command
        if (shouldRebuild) {
          console.log('Triggering model rebuild (activate)...');
          // Update status to pending immediately to show rebuild is in progress
          this.status = 'pending';
          this.progressMessage = {
            step: 'Starting rebuild',
            progress: 0
          };
          this.activateModel();
        } else {
          // Just refresh the current model to reflect changes
          this.refreshModel();
        }
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
    // eslint-disable-next-line @typescript-eslint/no-shadow
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
        console.log('Forecast created successfully:', response);
        // Get the new model ID from the response (handle both ForecastId object and string)
        const newModelId: string = typeof response.id === 'string' ? response.id : response.id?.id;

        if (newModelId) {
          // Add the new model to the models list
          const newModel: Order = {
            id: response.name || newModelId.substring(0, 8),
            trueId: newModelId,
            device: '', // Will be populated when navigating to the page
            date: new Date().toISOString()
          };

          // Update the models list if it exists
          if (this.models) {
            this.models.push(newModel);
            this.updateFilteredModels();
            this.fetchModelNames(); // Fetch the name for the new model
          }

          // Navigate to the new model page
          this.router.navigate(['/predictiveMaintenance/model', newModelId], {
            state: { forecastData: this.models || [newModel] }
          });
        } else {
          // Fallback: navigate to PM list if ID is not available
          console.warn('Model ID not found in response, navigating to PM list');
          this.router.navigateByUrl('/PM');
        }
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
    // Only reset progressMessage if it's not already set (to preserve rebuild message)
    if (!this.progressMessage) {
      this.progressMessage = null;
    }
    // Set status to pending if not already set
    if (this.status !== 'pending') {
      this.status = 'pending';
    }
    this.modelWebSocketService.sendActivateCommand(this.trueId).subscribe((msg) => {
        this.handleWebSocketMessage(msg);
    });
    this.displayLogsTooltip();
  }

  private shouldShowLogsTooltip(): boolean {
    // Always show for testing purposes
    return true;

    // Uncomment below for production behavior
    // try {
    //   const dontShow = localStorage.getItem(this.LOGS_TOOLTIP_PREFERENCE_KEY);
    //   return dontShow !== 'true';
    // } catch (error) {
    //   console.warn('Error checking logs tooltip preference:', error);
    //   return true;
    // }
  }

  private displayLogsTooltip(): void {
    if (!this.shouldShowLogsTooltip() || !this.logsButton) {
      return;
    }

    this.positionLogsTooltip();
    this.showLogsTooltip = true;
  }

  closeLogsTooltip(): void {
    this.showLogsTooltip = false;
  }

  confirmLogsTooltip(): void {
    if (this.dontShowLogsTooltipAgain) {
      try {
        localStorage.setItem(this.LOGS_TOOLTIP_PREFERENCE_KEY, 'true');
      } catch (error) {
        console.warn('Error saving logs tooltip preference:', error);
      }
    }
    this.showLogsTooltip = false;
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
        // this.status = 'active';
        this.status = 'inactive';
        this.anomaliesComponent.setStreamStatus(true, null);
        // Show the logs tooltip after activation
        // this.displayLogsTooltip();
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
  toggleTimeSeriesChart(): void {
    this.timeSeriesChartCollapsed = !this.timeSeriesChartCollapsed;
    this.saveCollapsedStates();
  }

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
      console.log('Loading collapsed states for model:', this.trueId || 'default');
      const savedStates = localStorage.getItem(
        'forecast-dashboard-collapsed-states-' + (this.trueId || 'default')
      );
      console.log(savedStates);
      if (savedStates) {
        const states = JSON.parse(savedStates);
        this.timeSeriesChartCollapsed = states.timeSeriesChartCollapsed || false;
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
        timeSeriesChartCollapsed: this.timeSeriesChartCollapsed,
        forecastChartCollapsed: this.forecastChartCollapsed,
        anomaliesCollapsed: this.anomaliesCollapsed,
      };
      localStorage.setItem(
        'forecast-dashboard-collapsed-states-' + (this.trueId || 'default'),
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
        this.selectedSensor = preferences.selectedSensor || 'rotate';
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
        this.selectedSensor = 'rotate';
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
          selectedSensor: this.selectedSensor,
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
        selectedSensor: this.selectedSensor,
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

  /**
   * Handle sensor change from forecast chart
   */
  onSensorChanged(sensor: string): void {
    this.selectedSensor = sensor;
    this.saveViewPreferences();
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

  /**
   * Load the last read log timestamp from localStorage
   */
  private loadLastReadLogTimestamp(): void {
    if (!this.trueId) {
      return;
    }
    const key = this.LAST_READ_LOG_KEY_PREFIX + this.trueId;
    const stored = localStorage.getItem(key);
    if (stored) {
      this.lastReadLogTimestamp = parseInt(stored, 10);
    } else {
      this.lastReadLogTimestamp = 0;
    }
  }

  /**
   * Save the last read log timestamp to localStorage
   */
  private saveLastReadLogTimestamp(): void {
    if (!this.trueId) {
      return;
    }
    const key = this.LAST_READ_LOG_KEY_PREFIX + this.trueId;
    localStorage.setItem(key, Date.now().toString());
    this.lastReadLogTimestamp = Date.now();
  }
}
