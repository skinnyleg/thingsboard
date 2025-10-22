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

import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  NgZone,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '@shared/shared.module';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as echarts from 'echarts/core';
import {
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent
} from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { Subscription } from 'rxjs';
import { TelemetryWebsocketService } from '@core/ws/telemetry-websocket.service';
import { TelemetrySubscriber, SubscriptionUpdate, LatestTelemetry, DataSortOrder } from '@shared/models/telemetry/telemetry.models';
import { EntityId } from '@shared/models/id/entity-id';
import { EntityType } from '@shared/models/entity-type.models';
import { TranslateService } from '@ngx-translate/core';
import { ECharts, echartsModule } from '@home/components/widget/lib/chart/echarts-widget.models';
import { AttributeService } from '@core/http/attribute.service';
import { Timewindow, QuickTimeInterval, AggregationType } from '@shared/models/time/time.models';

// Register ECharts components
echarts.use([
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  LineChart,
  UniversalTransition,
  CanvasRenderer
]);

@Component({
  selector: 'tb-time-series-telemetry',
  templateUrl: './time-series-telemetry.component.html',
  styleUrls: ['./time-series-telemetry.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule
  ]
})
export class TimeSeriesTelemetryComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {

  @ViewChild('chart', { static: false }) chartElement: ElementRef<HTMLElement>;

  @Input() deviceId: string;

  @Input() selectedSensor: string; // Single sensor - can be provided explicitly or auto-selected

  @Input() title = 'Sensor Telemetry';

  @Input() forecastData: any; // Forecast data passed from parent component

  @Input() forecastMaxSteps: number; // Number of forecast steps

  @Output() sensorChanged = new EventEmitter<string>();

  // Available sensors fetched from device
  availableSensors: string[] = [];

  // Track if sensor was explicitly provided vs auto-selected
  private sensorExplicitlyProvided = false;

  // Forecast data points for the chart
  private forecastDataPoints: Array<[number, number]> = [];

  // Timewindow configuration
  timewindow: Timewindow = {
    displayValue: '',
    hideInterval: false,
    hideAggregation: false,
    hideAggInterval: false,
    hideTimezone: false,
    selectedTab: 0,
    realtime: {
      realtimeType: 0,
      interval: 60000,
      timewindowMs: 60000,
      quickInterval: QuickTimeInterval.CURRENT_DAY
    }
  };

  private chart: ECharts;

  private chartOptions: any;

  private telemetrySubscription: Subscription;

  private timeAxisUpdateInterval: any;

  private resizeObserver: ResizeObserver;

  // Data storage - array of [timestamp, value] for the selected sensor
  private telemetryData: Array<[number, number]> = [];

  // Chart colors for different sensors - dynamically assigned
  private sensorColors: Map<string, string> = new Map();

  // Color palette for sensor assignment
  private colorPalette: string[] = [
    '#2196f3', // Blue
    '#ff9800', // Orange
    '#4caf50', // Green
    '#f44336', // Red
    '#9c27b0', // Purple
    '#00bcd4', // Cyan
    '#ffeb3b', // Yellow
    '#e91e63', // Pink
    '#009688', // Teal
    '#ff5722', // Deep Orange
    '#673ab7', // Deep Purple
    '#3f51b5', // Indigo
    '#cddc39', // Lime
    '#ffc107', // Amber
    '#795548'  // Brown
  ];

  constructor(
    private telemetryWsService: TelemetryWebsocketService,
    private attributeService: AttributeService,
    private translate: TranslateService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize empty data array
    this.telemetryData = [];

    // Track if sensor was explicitly provided
    this.sensorExplicitlyProvided = !!this.selectedSensor;

    // Fetch available sensors if deviceId is provided
    if (this.deviceId) {
      this.fetchAvailableSensors();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.deviceId && !changes.deviceId.firstChange) {
      // Device changed - fetch sensors and resubscribe
      if (this.telemetrySubscription) {
        this.telemetrySubscription.unsubscribe();
      }
      this.clearData();
      this.forecastDataPoints = [];
      if (this.deviceId) {
        this.fetchAvailableSensors();
      }
    }

    if (changes.selectedSensor && !changes.selectedSensor.firstChange) {
      // Sensor was explicitly changed - mark it as explicitly provided
      this.sensorExplicitlyProvided = !!this.selectedSensor;

      // Sensor changed - resubscribe
      if (this.telemetrySubscription) {
        this.telemetrySubscription.unsubscribe();
      }
      this.clearData();
      if (this.deviceId && this.selectedSensor) {
        this.subscribeToTelemetry();
      }
      // Process forecast data for the new sensor
      if (this.forecastData) {
        this.processForecastData();
      }
      if (this.chart) {
        this.updateChart();
      }
    }

    if (changes.forecastData) {
      // Forecast data changed - process it
      // console.log('[TIME-SERIES] ✓ Forecast data change detected:', {
      //   firstChange: changes.forecastData.firstChange,
      //   sensors: this.forecastData ? Object.keys(this.forecastData) : [],
      //   selectedSensor: this.selectedSensor,
      //   previousValue: changes.forecastData.previousValue,
      //   currentValue: changes.forecastData.currentValue
      // });

      if (!changes.forecastData.firstChange) {
        // console.log('[TIME-SERIES] Processing forecast data update (not first change)');
      } else {
        // console.log('[TIME-SERIES] Processing forecast data update (first change)');
      }

      this.processForecastData();
      if (this.chart) {
        this.updateChart();
      }
    }
  }

  ngAfterViewInit(): void {
    // Initialize ECharts
    this.initializeChart();

    // Subscribe to telemetry if device ID and sensor are available
    if (this.deviceId && this.selectedSensor) {
      this.subscribeToTelemetry();
    }

    // Process forecast data if available
    if (this.forecastData) {
      this.processForecastData();
    }

    // Start time axis update interval (update every second)
    this.startTimeAxisUpdate();

    // Setup resize observer to handle window/container resize
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    if (this.telemetrySubscription) {
      this.telemetrySubscription.unsubscribe();
    }
    if (this.timeAxisUpdateInterval) {
      clearInterval(this.timeAxisUpdateInterval);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.chart) {
      this.chart.dispose();
    }
  }

  private initializeChart(): void {
    if (!this.chartElement?.nativeElement) {
      return;
    }

    // Initialize ECharts module
    echartsModule.init();

    // Create chart instance
    this.chart = echarts.init(this.chartElement.nativeElement, null, {
      renderer: 'canvas'
    });

    // Define chart options
    this.chartOptions = {
      darkMode: true,
      backgroundColor: 'transparent',
      animation: false,
      title: {
        text: this.title,
        left: 'center',
        textStyle: {
          color: '#fff',
          fontSize: 16
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
        data: [this.selectedSensor],
        top: 40,
        textStyle: {
          color: '#fff'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        scale: true,
        axisLabel: {
          color: '#fff',
          formatter: (value: number, index: number) => {
            const date = new Date(value);

            // Calculate time range in milliseconds
            const timeRange = this.timewindow.realtime
              ? this.timewindow.realtime.timewindowMs || 60000
              : (this.timewindow.history?.timewindowMs || 3600000);

            // Determine format based on time range
            if (timeRange < 3600000) {
              // Less than 1 hour - show HH:MM:SS
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              const seconds = date.getSeconds().toString().padStart(2, '0');
              return `${hours}:${minutes}:${seconds}`;
            } else if (timeRange < 86400000) {
              // Less than 1 day - show HH:MM
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              return `${hours}:${minutes}`;
            } else if (timeRange < 2592000000) {
              // Less than 30 days - show MMM DD HH:mm
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const month = months[date.getMonth()];
              const day = date.getDate();
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              return `${month} ${day}\n${hours}:${minutes}`;
            } else {
              // More than 30 days - show MMM DD
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const month = months[date.getMonth()];
              const day = date.getDate();
              return `${month} ${day}`;
            }
          },
          interval: 'auto',
          hideOverlap: true
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
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: true
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 30,
          bottom: 10,
          textStyle: {
            color: '#fff'
          },
          handleStyle: {
            color: '#2196f3'
          },
          borderColor: '#fff'
        }
      ],
      series: this.createSeries()
    };

    // Set initial options
    this.chart.setOption(this.chartOptions);
  }

  private createSeries(): any[] {
    if (!this.selectedSensor) {
      return [];
    }

    return [{
      name: this.selectedSensor,
      type: 'line',
      data: [],
      smooth: false,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: this.sensorColors.get(this.selectedSensor) || '#2196f3'
      },
      itemStyle: {
        color: this.sensorColors.get(this.selectedSensor) || '#2196f3'
      }
    }];
  }

  private assignColorsToSensors(): void {
    // Assign colors to sensors that don't have colors yet
    this.availableSensors.forEach((sensor, index) => {
      if (!this.sensorColors.has(sensor)) {
        // Assign color from palette, cycling through if we run out
        const color = this.colorPalette[index % this.colorPalette.length];
        this.sensorColors.set(sensor, color);
      }
    });
  }

  private fetchAvailableSensors(): void {
    if (!this.deviceId) {
      // console.warn('Cannot fetch sensors: missing deviceId');
      return;
    }

    const entityId: EntityId = {
      entityType: EntityType.DEVICE,
      id: this.deviceId
    };

    // Fetch latest telemetry to get available sensor keys
    this.attributeService.getEntityTimeseriesLatest(entityId).subscribe(
      (timeseriesData) => {
        // Extract all available telemetry keys
        this.availableSensors = Object.keys(timeseriesData);

        // Assign colors to sensors
        this.assignColorsToSensors();

        // Only auto-select if sensor was NOT explicitly provided via @Input
        if (!this.sensorExplicitlyProvided && !this.selectedSensor && this.availableSensors.length > 0) {
          this.selectedSensor = this.availableSensors[0];
          this.sensorChanged.emit(this.selectedSensor);
        }

        // Subscribe to telemetry if sensor is selected and chart is ready
        if (this.selectedSensor && this.chart) {
          this.subscribeToTelemetry();
        }

        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error fetching available sensors:', error);
        this.availableSensors = [];
      }
    );
  }

  private subscribeToTelemetry(): void {
    if (!this.deviceId || !this.selectedSensor) {
      // console.warn('Cannot subscribe to telemetry: missing deviceId or sensor');
      return;
    }

    // console.log(`Subscribing to telemetry for device ${this.deviceId}, sensor:`, this.selectedSensor);

    // Create entity ID
    const entityId: EntityId = {
      entityType: EntityType.DEVICE,
      id: this.deviceId
    };

    // Create telemetry subscriber for latest telemetry
    const subscriber = TelemetrySubscriber.createEntityAttributesSubscription(
      this.telemetryWsService,
      entityId,
      LatestTelemetry.LATEST_TELEMETRY,
      this.zone,
      [this.selectedSensor] // Pass as array with single sensor
    );

    // Subscribe to data updates
    this.telemetrySubscription = subscriber.data$.subscribe((update: SubscriptionUpdate) => {
      this.handleTelemetryUpdate(update);
    });

    // Start the subscription with the telemetry service
    this.telemetryWsService.subscribe(subscriber);
  }

  private processForecastData(): void {
    if (!this.forecastData || !this.selectedSensor) {
      // console.log('[TIME-SERIES] No forecast data or sensor selected');
      this.forecastDataPoints = [];
      return;
    }

    // console.log('[TIME-SERIES] Processing forecast data for sensor:', this.selectedSensor);
    // console.log('[TIME-SERIES] Available sensors in forecast:', Object.keys(this.forecastData));

    // Get forecast data for the selected sensor
    if (this.forecastData[this.selectedSensor]) {
      const sensorForecast = this.forecastData[this.selectedSensor];
      // console.log('[TIME-SERIES] Sensor forecast data:', sensorForecast);

      // Convert forecast data to [timestamp, value] format
      if (sensorForecast.forecast && sensorForecast.timestamp) {
        this.forecastDataPoints = sensorForecast.timestamp.map((ts: number, index: number) => [ts, sensorForecast.forecast[index]]);

        console.log(`[TIME-SERIES] ✓ Loaded ${this.forecastDataPoints.length} forecast points for sensor ${this.selectedSensor}`);
        console.log('[TIME-SERIES] First few points:', this.forecastDataPoints.slice(0, 3));
      } else {
        console.warn(`[TIME-SERIES] Sensor forecast missing 'forecast' or 'timestamp' fields:`, sensorForecast);
        this.forecastDataPoints = [];
      }
    } else {
      console.warn(`[TIME-SERIES] No forecast data found for sensor: ${this.selectedSensor}`);
      console.warn('[TIME-SERIES] Available sensors in forecast data:', Object.keys(this.forecastData));
      this.forecastDataPoints = [];
    }
  }

  private handleTelemetryUpdate(update: SubscriptionUpdate): void {
    if (!update || !update.data) {
      return;
    }

    // console.log('Telemetry update received:', update);

    // Process incoming telemetry data for the selected sensor
    const sensorKey = this.selectedSensor;
    if (update.data[sensorKey]) {
      const values = update.data[sensorKey];
      if (Array.isArray(values)) {
        values.forEach(dataPoint => {
          // dataPoint is [timestamp, value]
          const timestamp = dataPoint[0];
          const value = parseFloat(dataPoint[1]);

          // Check if this timestamp already exists to avoid duplicates
          const existingIndex = this.telemetryData.findIndex(d => d[0] === timestamp);
          if (existingIndex >= 0) {
            // Update existing value
            this.telemetryData[existingIndex] = [timestamp, value];
          } else {
            // Add new data point
            this.telemetryData.push([timestamp, value]);
          }
        });

        // Keep only last 1000 points to avoid memory issues
        if (this.telemetryData.length > 1000) {
          this.telemetryData = this.telemetryData.slice(-1000);
        }

        // Sort by timestamp
        this.telemetryData.sort((a, b) => a[0] - b[0]);
      }
    }

    // Update chart
    this.updateChart();
    this.cdr.detectChanges();
  }

  private updateChart(): void {
    if (!this.chart) {
      return;
    }

    // Get current time window based on timewindow settings
    const { minTime, maxTime } = this.calculateTimeWindow();

    // Get the color for the selected sensor
    const sensorColor = this.sensorColors.get(this.selectedSensor) || '#2196f3';

    // Prepare series array
    const seriesArray: any[] = [
      {
        name: this.selectedSensor,
        type: 'line',
        data: this.telemetryData,
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: {
          width: 2,
          color: sensorColor
        },
        itemStyle: {
          color: sensorColor
        }
      }
    ];

    // Add forecast series if forecast data is available
    if (this.forecastDataPoints && this.forecastDataPoints.length > 0) {
      // console.log('[TIME-SERIES] Adding forecast series to chart with', this.forecastDataPoints.length, 'points');
      // console.log('[TIME-SERIES] Forecast data sample:', this.forecastDataPoints.slice(0, 3));
      seriesArray.push({
        name: `Forecast`, // Simplified name for debugging
        type: 'line',
        data: this.forecastDataPoints,
        smooth: false,
        symbol: 'circle',
        symbolSize: 6, // Larger symbols for better visibility
        lineStyle: {
          width: 3, // Thicker line for better visibility
          color: '#ff9800', // Orange color for contrast
          type: 'dashed' // Dashed line for forecast
        },
        itemStyle: {
          color: '#ff9800',
          opacity: 1 // Full opacity for debugging
        }
      });
    }

    // Update legend to include forecast if available
    const legendData = this.forecastDataPoints && this.forecastDataPoints.length > 0
      ? [this.selectedSensor, 'Forecast'] // Simplified legend
      : [this.selectedSensor];

    // console.log('[TIME-SERIES] Updating chart with:', {
    //   telemetryPoints: this.telemetryData.length,
    //   forecastPoints: this.forecastDataPoints.length,
    //   seriesCount: seriesArray.length,
    //   timeWindow: { minTime: new Date(minTime), maxTime: new Date(maxTime) }
    // });

    // Update series data and axis range without animation
    this.chart.setOption({
      xAxis: {
        min: minTime,
        max: maxTime
      },
      legend: {
        data: legendData
      },
      series: seriesArray
    }, false, false);

    // console.log('[TIME-SERIES] Chart updated successfully');
  }

  private calculateTimeWindow(): { minTime: number; maxTime: number } {
    const now = Date.now();
    let minTime: number;
    let maxTime: number = now;

    // Determine time window based on timewindow configuration
    if (this.timewindow.realtime) {
      // Realtime mode - use timewindowMs from configuration
      const timewindowMs = this.timewindow.realtime.timewindowMs || 60000; // Default to 1 minute
      minTime = now - timewindowMs;
    } else if (this.timewindow.history) {
      // History mode - use fixed start/end time
      minTime = this.timewindow.history.timewindowMs || (now - 3600000); // Default to 1 hour ago
      maxTime = this.timewindow.history.historyType === 0
        ? now
        : (minTime + (this.timewindow.history.timewindowMs || 3600000));
    } else {
      // Default fallback - last 1 minute
      minTime = now - 60000;
    }

    return { minTime, maxTime };
  }

  private startTimeAxisUpdate(): void {
    // Update time axis every second to keep it moving
    this.timeAxisUpdateInterval = setInterval(() => {
      if (this.chart) {
        const { minTime, maxTime } = this.calculateTimeWindow();

        // Update only the x-axis without changing series data
        this.chart.setOption({
          xAxis: {
            min: minTime,
            max: maxTime
          }
        }, false, false);
      }
    }, 1000); // Update every second
  }

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

  private clearData(): void {
    this.telemetryData = [];
  }

  private fetchHistoricalData(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.deviceId || !this.selectedSensor) {
        // console.warn('Cannot fetch historical data: missing deviceId or sensor');
        resolve();
        return;
      }

      const entityId: EntityId = {
        entityType: EntityType.DEVICE,
        id: this.deviceId
      };

      // Calculate time range based on timewindow
      const { minTime, maxTime } = this.calculateTimeWindow();

      // Add extra 1 minute buffer to fetch more data points (in milliseconds)
      const bufferMs = 60000; // 1 minute
      const fetchMinTime = minTime - bufferMs;
      const fetchMaxTime = maxTime;

      // Get aggregation settings from timewindow
      const aggregationType = this.timewindow.aggregation?.type || AggregationType.NONE;
      const limit = this.timewindow.aggregation?.limit || 1000;
      const intervalValue = this.timewindow.aggregation?.interval;

      // Convert interval to number if needed
      let intervalMs: number | undefined;
      if (intervalValue !== undefined) {
        intervalMs = typeof intervalValue === 'number' ? intervalValue : undefined;
      }

      // console.log(`Fetching historical data for ${this.selectedSensor} from ${new Date(fetchMinTime)} to ${new Date(fetchMaxTime)}`);
      // console.log(`Actual display range: ${new Date(minTime)} to ${new Date(maxTime)}`);
      // console.log(`Aggregation: ${aggregationType}, Interval: ${intervalMs}, Limit: ${limit}`);

      // Fetch historical telemetry data with buffer
      this.attributeService.getEntityTimeseries(
        entityId,
        [this.selectedSensor],
        fetchMinTime,
        fetchMaxTime,
        limit,
        aggregationType,
        intervalMs,
        DataSortOrder.ASC
      ).subscribe({
        next: (data) => {
          // console.log('Historical data received:', data);

          // Process historical data
          if (data && data[this.selectedSensor]) {
            const historicalPoints = data[this.selectedSensor];

            // Convert to [timestamp, value] format
            const allDataPoints: Array<[number, number]> = historicalPoints.map((point: any) => [point.ts, parseFloat(point.value)]);

            // Filter out data points outside the actual requested time range
            // Keep data points within [minTime, maxTime]
            this.telemetryData = allDataPoints.filter(point => point[0] >= minTime && point[0] <= maxTime);

            // Sort by timestamp
            this.telemetryData.sort((a, b) => a[0] - b[0]);

            // console.log(`Fetched ${allDataPoints.length} total data points, filtered to ${this.telemetryData.length} points within range`);
            // console.log(`Aggregation: ${aggregationType}`);

            // Update chart with historical data
            this.updateChart();
            this.cdr.detectChanges();
          }

          resolve();
        },
        error: (error) => {
          console.error('Error fetching historical data:', error);
          resolve(); // Resolve anyway to continue with realtime subscription
        }
      });
    });
  }

  onTimewindowChanged(timewindow: Timewindow): void {
    // console.log('====== Timewindow changed ======');
    // console.log('New timewindow:', timewindow);
    // console.log('DeviceId:', this.deviceId, 'SelectedSensor:', this.selectedSensor);

    this.timewindow = timewindow;

    // Unsubscribe from current telemetry
    if (this.telemetrySubscription) {
      // console.log('Unsubscribing from existing telemetry subscription');
      this.telemetrySubscription.unsubscribe();
    }

    // Clear existing data
    // console.log('Clearing existing data');
    this.clearData();

    // Update chart to clear it immediately
    this.updateChart();

    // Fetch historical data first, then subscribe to realtime updates
    if (this.deviceId && this.selectedSensor) {
      // console.log('Starting historical data fetch...');
      this.fetchHistoricalData().then(() => {
        // console.log('Historical data fetch completed');
        // After historical data is loaded, subscribe to realtime updates if in realtime mode
        if (this.timewindow.realtime) {
          // console.log('Re-subscribing to realtime telemetry');
          this.subscribeToTelemetry();
        }
        // Chart is already updated in fetchHistoricalData, no need to call updateChart again
      });
    } else {
      // console.log('Skipping historical data fetch - missing deviceId or selectedSensor');
    }
    // console.log('====== End timewindow change ======');
  }

  selectSensor(sensor: string): void {
    if (this.selectedSensor === sensor) {
      return; // Already selected
    }

    this.selectedSensor = sensor;
    this.onSensorChange();
  }

  onSensorChange(): void {
    // console.log('Sensor changed to:', this.selectedSensor);

    // Get the color for the selected sensor
    const sensorColor = this.sensorColors.get(this.selectedSensor) || '#2196f3';
    // console.log(`Switching to sensor ${this.selectedSensor} with color ${sensorColor}`);

    // Emit sensor change event
    this.sensorChanged.emit(this.selectedSensor);

    // Unsubscribe from current telemetry
    if (this.telemetrySubscription) {
      this.telemetrySubscription.unsubscribe();
    }

    // Clear existing data
    this.clearData();

    // Clear forecast data points
    this.forecastDataPoints = [];

    // Process forecast data for the new sensor
    if (this.forecastData) {
      this.processForecastData();
    }

    // Update chart with new sensor color, legend, and axis labels
    if (this.chart) {
      this.chart.setOption({
        legend: {
          data: [this.selectedSensor]
        },
        yAxis: {
          name: this.selectedSensor
        },
        series: [{
          name: this.selectedSensor,
          type: 'line',
          data: [],
          smooth: false,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            width: 2,
            color: sensorColor
          },
          itemStyle: {
            color: sensorColor
          }
        }]
      }, false, false);
    }

    // Resubscribe with new sensor
    if (this.deviceId && this.selectedSensor) {
      this.subscribeToTelemetry();
    }
  }
}
