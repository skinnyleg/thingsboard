import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { AttributeService } from '@core/http/attribute.service';
import { TelemetryWebsocketService } from '@core/ws/telemetry-websocket.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { PredictiveModelsService } from '@core/http/forecast.service';
import { ModelWebSocketService } from '@core/http/model-websocket.service';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import * as echarts from 'echarts/core';
import {
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkAreaComponent,
} from 'echarts/components';
import { LineChart, ScatterChart } from 'echarts/charts';
import { UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { Subscription } from 'rxjs';
import { ECharts, echartsModule } from '../../../widget/lib/chart/echarts-widget.models';
import { TelemetrySubscriber, SubscriptionUpdate, LatestTelemetry } from '@shared/models/telemetry/telemetry.models';
import { EntityId } from '@shared/models/id/entity-id';
import { EntityType } from '@shared/models/entity-type.models';

// Register ECharts components
echarts.use([
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkAreaComponent,
  LineChart,
  ScatterChart,
  UniversalTransition,
  CanvasRenderer
]);

@Component({
  selector: 'tb-forecast-chart',
  templateUrl: './forecast-chart.component.html',
  styleUrls: ['./forecast-chart.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatMenuModule,
    MatDividerModule,
    FormsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDatepickerModule,
    TranslateModule,
  ],
})
export class ForecastChartComponent
  implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() deviceId: string;

  @Input() Attributes: string[];

  @Input() forecastId: string;

  @Input() forecastData: any; // Forecast data from parent component

  @Input() forecastMaxSteps: number; // Number of forecast points

  @Input() selectedSensor = 'rotate'; // Currently selected sensor (from parent viewPreferences)

  @Output() sensorChanged = new EventEmitter<string>();

  @ViewChild('chart', { static: false }) chartElement: ElementRef<HTMLElement>;

  private chart: ECharts;

  private chartOptions: any;

  private telemetrySubscription: Subscription;

  private resizeObserver: ResizeObserver;

  // Data storage
  private historicalData: Array<[number, number]> = [];

  private forecastDataPoints: Array<[number, number]> = [];

  // UI State properties
  isExpanded = false;

  isRefreshing = false;

  hasNoData = false;

  noDataMessage = 'No data available';

  // Job state properties
  isPaused = false;

  jobRunning = false;

  // History mode properties
  isHistoryMode = false;

  isRealtimeMode = true;

  startDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  endDate: Date = new Date();

  // Time selection options
  selectionOptions = [
    { name: 'Last hour', value: 'hour' },
    { name: 'Last 24 hours', value: '24h' },
    { name: 'Last 7 days', value: '7d' },
    { name: 'Last 30 days', value: '30d' }
  ];

  selected = { value: '24h' };

  // Available sensors for selection
  availableSensors = ['rotate', 'temp', 'pressure', 'vibration'];

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private predictiveModelsService: PredictiveModelsService,
    private modelWebSocketService: ModelWebSocketService,
    private renderer: Renderer2
  ) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.forecastData && changes.forecastData.currentValue) {
      // console.log('[FORECAST-CHART] ✓ Forecast data received from parent:', {
      //   sensors: Object.keys(changes.forecastData.currentValue),
      //   data: changes.forecastData.currentValue
      // });
      this.processForecastData(changes.forecastData.currentValue);
      if (this.chart) {
        this.updateChartData();
      }
    }

    if (changes.selectedSensor && !changes.selectedSensor.firstChange) {
      // console.log('[FORECAST-CHART] Selected sensor changed to:', changes.selectedSensor.currentValue);
      // Resubscribe to telemetry for the new sensor
      if (this.telemetrySubscription) {
        this.telemetrySubscription.unsubscribe();
      }
      this.historicalData = [];
      this.subscribeToTelemetry();
    }
  }

  ngOnInit(): void {
    if (this.forecastId) {
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    if (this.telemetrySubscription) {
      this.telemetrySubscription.unsubscribe();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.chart) {
      this.chart.dispose();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (this.chart) {
      this.chart.resize();
    }
  }

  ngAfterViewInit(): void {
    // Use setTimeout to ensure the view is fully rendered
    setTimeout(() => {
      // Initialize ECharts
      this.initializeChart();

      // Initialize telemetry subscription for the device
      if (this.deviceId && this.selectedSensor) {
        this.subscribeToTelemetry();
      }

      // Process initial forecast data if available
      if (this.forecastData) {
        this.processForecastData(this.forecastData);
        if (this.chart) {
          this.updateChartData();
        }
      }

      // Check initial job status
      if (this.forecastId) {
        this.checkJobStatus();
      }

      // Setup resize observer
      this.setupResizeObserver();
    }, 0);
  }

  // Setup ResizeObserver to watch for container size changes
  private setupResizeObserver(): void {
    if (!this.chartElement?.nativeElement) {
      return;
    }

    // Create ResizeObserver to watch for container size changes
    this.resizeObserver = new ResizeObserver(() => {
      if (this.chart) {
        // Resize chart to fit new container dimensions
        this.chart.resize();
      }
    });

    // Observe the chart container element
    this.resizeObserver.observe(this.chartElement.nativeElement);
  }

  // Check job status to initialize pause/unpause button state
  checkJobStatus(): void {
    if (!this.forecastId) {
      return;
    }

    // console.log('[FORECAST-CHART] Checking job status for', this.forecastId);

    const commandId = Date.now();
    const command = {
      commandId: commandId,
      type: 'job_status',
      forecastId: this.forecastId,
      data: {
        modelType: 'forecast'
      }
    };

    // Subscribe to job status updates
    this.modelWebSocketService.subscribeToJobStatus(this.forecastId, 'forecast').subscribe({
      next: (response: any) => {
        // console.log('[FORECAST-CHART] Job status response:', response);
        if (response.data) {
          const status = response.data.status || response.data.data?.status;
          const paused = response.data.paused || response.data.data?.paused || false;

          this.jobRunning = status === 'running';
          this.isPaused = paused;
          this.cdr.detectChanges();

          // console.log('[FORECAST-CHART] Updated job state:', {
          //   running: this.jobRunning,
          //   paused: this.isPaused
          // });
        }
      },
      error: (error) => {
        // console.error('[FORECAST-CHART] Error checking job status:', error);
      }
    });
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    // Resize chart after expansion/collapse
    setTimeout(() => {
      if (this.chart) {
        this.chart.resize();
      }
    }, 300); // Wait for CSS transition to complete
  }

  // refresh chart data
  refreshChart(): void {
    this.isRefreshing = true;
    // Resubscribe to telemetry to get fresh data
    if (this.telemetrySubscription) {
      this.telemetrySubscription.unsubscribe();
    }
    this.subscribeToTelemetry();
    // Reset refreshing state after a delay
    setTimeout(() => {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  // Pause prediction job
  pausePredictions(): void {
    if (!this.forecastId) {
      // console.error('[FORECAST-CHART] Cannot pause: No forecast ID');
      return;
    }

    // console.log('[FORECAST-CHART] Pausing predictions for', this.forecastId);

    // Send pause command via WebSocket
    const commandId = Date.now();
    const command = {
      commandId: commandId,
      type: 'pause_job',
      forecastId: this.forecastId,
      data: {
        modelType: 'forecast'
      }
    };

    this.modelWebSocketService.connect();
    const ws$ = this.modelWebSocketService.connect();
    ws$.next(command);

    // Update UI state
    this.isPaused = true;
    this.cdr.detectChanges();

    // console.log('[FORECAST-CHART] Pause command sent:', command);
  }

  // Resume (unpause) prediction job
  unpausePredictions(): void {
    if (!this.forecastId) {
      // console.error('[FORECAST-CHART] Cannot unpause: No forecast ID');
      return;
    }

    // console.log('[FORECAST-CHART] Resuming predictions for', this.forecastId);

    // Send unpause command via WebSocket
    const commandId = Date.now();
    const command = {
      commandId: commandId,
      type: 'unpause_job',
      forecastId: this.forecastId,
      data: {
        modelType: 'forecast'
      }
    };

    this.modelWebSocketService.connect();
    const ws$ = this.modelWebSocketService.connect();
    ws$.next(command);

    // Update UI state
    this.isPaused = false;
    this.cdr.detectChanges();

    // console.log('[FORECAST-CHART] Unpause command sent:', command);
  }

  toggleMode(): void {
    this.isRealtimeMode = !this.isRealtimeMode;
    this.isHistoryMode = !this.isHistoryMode;

    if (this.isRealtimeMode) {
      // Switch to realtime mode - subscribe to live telemetry
      this.subscribeToTelemetry();
    } else {
      // Switch to history mode - unsubscribe from live updates
      if (this.telemetrySubscription) {
        this.telemetrySubscription.unsubscribe();
      }
    }
  }

  toggleDatePicker(datepicker: any): void {
    // Toggle datepicker visibility (handled by template)
  }

  updateEndDate(): void {
    this.endDate = new Date();
    this.cdr.detectChanges();
  }

  onSelectTimeChange(selection: { value: string }): void {
    this.selected = selection;

    // Update time range based on selection
    const now = Date.now();
    let startTime: number;

    switch (selection.value) {
      case 'hour':
        startTime = now - 60 * 60 * 1000; // 1 hour ago
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
        break;
      default:
        startTime = now - 24 * 60 * 60 * 1000; // Default to 24 hours
    }

    this.startDate = new Date(startTime);
    this.endDate = new Date(now);

    // If in history mode, reload data for the new time range
    if (this.isHistoryMode) {
      this.loadHistoricalData(this.startDate, this.endDate);
    }
  }

  // Time selection helper methods
  getHours(): string[] {
    const hours: string[] = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i < 10 ? '0' + i : i.toString());
    }
    return hours;
  }

  getMinutes(): string[] {
    const minutes: string[] = [];
    for (let i = 0; i < 60; i++) {
      minutes.push(i < 10 ? '0' + i : i.toString());
    }
    return minutes;
  }

  getSeconds(): string[] {
    const seconds: string[] = [];
    for (let i = 0; i < 60; i++) {
      seconds.push(i < 10 ? '0' + i : i.toString());
    }
    return seconds;
  }

  handleHistoryTimeChange(
    dateStartRange: any,
    dateEndRange: any,
    startDateHours: any,
    startDateMinutes: any,
    startDateSeconds: any,
    endDateHours: any,
    endDateMinutes: any,
    endDateSeconds: any
  ): void {
    // Extract selected dates from calendar components
    const startDate = new Date(dateStartRange.selected);
    const endDate = new Date(dateEndRange.selected);

    // Set hours, minutes, seconds from selects
    startDate.setHours(parseInt(startDateHours.value, 10));
    startDate.setMinutes(parseInt(startDateMinutes.value, 10));
    startDate.setSeconds(parseInt(startDateSeconds.value, 10));

    endDate.setHours(parseInt(endDateHours.value, 10));
    endDate.setMinutes(parseInt(endDateMinutes.value, 10));
    endDate.setSeconds(parseInt(endDateSeconds.value, 10));

    this.startDate = startDate;
    this.endDate = endDate;

    // Load historical data for the selected time range
    this.loadHistoricalData(startDate, endDate);
  }

  private loadHistoricalData(startDate: Date, endDate: Date): void {
    // TODO: Implement historical data loading
    // This would typically fetch historical telemetry data from the server
    // for the specified time range
    console.log('Loading historical data from', startDate, 'to', endDate);
  }

  // Sensor selection methods
  onSensorChange(sensor: string): void {
    this.selectedSensor = sensor;
  }

  private initializeChart(): void {
    if (!this.chartElement?.nativeElement) {
      // console.error('[FORECAST-CHART] Cannot initialize chart - element not found', {
      //   chartElement: this.chartElement,
      //   hasNativeElement: !!this.chartElement?.nativeElement
      // });
      return;
    }

    try {
      // Initialize ECharts module
      echartsModule.init();

      // Create chart instance
      this.chart = echarts.init(this.chartElement.nativeElement, null, {
        renderer: 'canvas'
      });

      // console.log('[FORECAST-CHART] ✓ Chart initialized successfully');
    } catch (error) {
      // console.error('[FORECAST-CHART] Failed to initialize chart:', error);
      return;
    }

    // Define chart options
    this.chartOptions = {
      darkMode: true,
      backgroundColor: 'transparent',
      title: {
        text: this.translate.instant('predictive-maintenance.forecast-chart'),
        left: 'center',
        textStyle: {
          color: '#fff'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) {
            return '';
          }
          const timestamp = params[0].value[0];
          const date = new Date(timestamp);
          let html = `<div style="font-weight: bold;">${date.toLocaleString()}</div>`;
          params.forEach((param: any) => {
            const value = param.value[1];
            html += `<div style="color: ${param.color};">
              ${param.seriesName}: ${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}
            </div>`;
          });
          return html;
        }
      },
      legend: {
        data: ['Historical Data', 'Forecast'],
        top: 30,
        textStyle: {
          color: '#fff'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          color: '#fff',
          formatter: (value: number) => {
            const date = new Date(value);
            return date.toLocaleTimeString();
          }
        },
        axisLine: {
          lineStyle: {
            color: '#fff'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: this.selectedSensor,
        nameTextStyle: {
          color: '#fff'
        },
        axisLabel: {
          color: '#fff'
        },
        axisLine: {
          lineStyle: {
            color: '#fff'
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          textStyle: {
            color: '#fff'
          }
        }
      ],
      series: [
        {
          name: 'Historical Data',
          type: 'line',
          data: [],
          smooth: false,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            width: 2,
            color: '#5470c6'
          },
          itemStyle: {
            color: '#5470c6'
          }
        },
        {
          name: 'Forecast',
          type: 'line',
          data: [],
          smooth: false,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            width: 2,
            type: 'dashed',
            color: '#ee6666'
          },
          itemStyle: {
            color: '#ee6666'
          }
        }
      ]
    };

    // Set initial options
    this.chart.setOption(this.chartOptions);
  }

  private processForecastData(forecastData: any): void {
    if (!forecastData) {
      // console.log('[FORECAST-CHART] No forecast data provided');
      return;
    }

    // console.log('[FORECAST-CHART] Processing forecast data:', {
    //   selectedSensor: this.selectedSensor,
    //   availableSensors: Object.keys(forecastData),
    //   data: forecastData
    // });

    this.forecastDataPoints = [];

    // Check if we have sensor-specific forecast data (new structure)
    if (this.selectedSensor && forecastData[this.selectedSensor]) {
      const sensorForecast = forecastData[this.selectedSensor];
      // console.log('[FORECAST-CHART] Found forecast for sensor:', this.selectedSensor, sensorForecast);

      // Convert forecast data to [timestamp, value] format
      if (sensorForecast.forecast && sensorForecast.timestamp) {
        this.forecastDataPoints = sensorForecast.timestamp.map((ts: number, index: number) => [ts, sensorForecast.forecast[index]]);
        // console.log(`[FORECAST-CHART] ✓ Loaded ${this.forecastDataPoints.length} forecast points for sensor ${this.selectedSensor}`);
        // console.log('[FORECAST-CHART] Forecast points data:', this.forecastDataPoints);
      } else {
        // console.warn('[FORECAST-CHART] Sensor forecast missing forecast or timestamp fields:', sensorForecast);
      }
    }
    // Legacy support: Check for old structure with predictions array
    else if (forecastData.predictions && Array.isArray(forecastData.predictions)) {
      this.forecastDataPoints = forecastData.predictions.map((item: any) => {
        const timestamp = item.timestamp || item.ts || item.time;
        const value = item.value || item.prediction;
        return [timestamp, value];
      });
      // console.log('[FORECAST-CHART] Loaded from predictions array:', this.forecastDataPoints.length);
    }
    // Legacy support: If forecastData is already an array
    else if (Array.isArray(forecastData)) {
      this.forecastDataPoints = forecastData.map((item: any) => {
        if (Array.isArray(item) && item.length >= 2) {
          return [item[0], item[1]];
        }
        const timestamp = item.timestamp || item.ts || item.time;
        const value = item.value || item.prediction;
        return [timestamp, value];
      });
      // console.log('[FORECAST-CHART] Loaded from array:', this.forecastDataPoints.length);
    } else {
      // console.warn('[FORECAST-CHART] No forecast data found for sensor:', this.selectedSensor);
      // console.warn('[FORECAST-CHART] Available sensors in forecast data:', Object.keys(forecastData));
    }

    // console.log('[FORECAST-CHART] Processed forecast data points:', this.forecastDataPoints.length);
  }

  private updateChartData(): void {
    if (!this.chart) {
      // console.warn('[FORECAST-CHART] Cannot update chart - chart not initialized');
      return;
    }

    // console.log('[FORECAST-CHART] Updating chart with:', {
    //   historicalDataPoints: this.historicalData.length,
    //   forecastDataPoints: this.forecastDataPoints.length,
    //   historicalSample: this.historicalData.slice(0, 2),
    //   forecastSample: this.forecastDataPoints.slice(0, 2)
    // });

    // Update series data
    this.chart.setOption({
      series: [
        {
          name: 'Historical Data',
          data: this.historicalData
        },
        {
          name: 'Forecast',
          data: this.forecastDataPoints
        }
      ]
    });

    this.hasNoData = this.historicalData.length === 0 && this.forecastDataPoints.length === 0;
    if (this.hasNoData) {
      this.noDataMessage = 'No data available for the selected sensor';
    }

    // console.log('[FORECAST-CHART] Chart updated, hasNoData:', this.hasNoData);
  }

  private subscribeToTelemetry(): void {
    if (!this.deviceId || !this.selectedSensor) {
      console.warn('Cannot subscribe to telemetry: missing deviceId or selectedSensor');
      this.hasNoData = true;
      this.noDataMessage = 'Missing device or sensor configuration';
      return;
    }

    console.log(`Subscribing to telemetry for device ${this.deviceId}, sensor: ${this.selectedSensor}`);

    // Create entity ID
    const entityId: EntityId = {
      entityType: EntityType.DEVICE,
      id: this.deviceId
    };

    // Create telemetry subscriber using the static factory method for timeseries data
    const subscriber = TelemetrySubscriber.createEntityAttributesSubscription(
      this.telemetryWsService,
      entityId,
      LatestTelemetry.LATEST_TELEMETRY,
      this.zone,
      [this.selectedSensor]
    );

    // Subscribe to data updates
    this.telemetrySubscription = subscriber.data$.subscribe((update: SubscriptionUpdate) => {
      this.handleTelemetryUpdate(update);
    });

    // Start the subscription with the telemetry service
    this.telemetryWsService.subscribe(subscriber);
  }

  private handleTelemetryUpdate(update: SubscriptionUpdate): void {
    if (!update || !update.data) {
      return;
    }

    // Process incoming telemetry data
    // console.log('Telemetry update received:', update);

    // SubscriptionUpdate.data is a map of key -> array of [timestamp, value]
    Object.keys(update.data).forEach(key => {
      if (key === this.selectedSensor) {
        const values = update.data[key];
        if (Array.isArray(values)) {
          values.forEach(dataPoint => {
            // dataPoint is [timestamp, value]
            const timestamp = dataPoint[0];
            const value = parseFloat(dataPoint[1]);

            // Check if this timestamp already exists to avoid duplicates
            const existingIndex = this.historicalData.findIndex(d => d[0] === timestamp);
            if (existingIndex >= 0) {
              // Update existing value
              this.historicalData[existingIndex] = [timestamp, value];
            } else {
              // Add new data point
              this.historicalData.push([timestamp, value]);
            }
          });

          // Keep only last 1000 points to avoid memory issues
          if (this.historicalData.length > 1000) {
            this.historicalData = this.historicalData.slice(-1000);
          }

          // Sort by timestamp
          this.historicalData.sort((a, b) => a[0] - b[0]);

          // Update chart
          this.updateChartData();
          this.cdr.detectChanges();
        }
      }
    });
  }
}
