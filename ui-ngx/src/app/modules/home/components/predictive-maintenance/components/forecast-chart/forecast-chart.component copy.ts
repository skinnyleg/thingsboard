import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { AttributeService } from '@core/http/attribute.service';
import { TelemetryWebsocketService } from '@core/ws/telemetry-websocket.service';
import { AttributeDatasource } from '@home/models/datasource/attribute-datasource';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { EntityId } from '@shared/models/id/entity-id';
import { TelemetryType } from '@shared/models/telemetry/telemetry.models';
import { from, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { PredictiveModelsService } from '@core/http/forecast.service';
import { ModelWebSocketService } from '@core/http/model-websocket.service';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import ApexCharts from 'apexcharts';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import { MatButtonModule } from '@angular/material/button';
import { CanvasRenderer } from 'echarts/renderers';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { FormControl } from '@angular/forms';
import { FormGroup } from '@material-ui/core';
import { environment } from '@env/environment';
import { ForecastPrediction, ForecastSensorPredictions } from '../anomalies/anomalies.component';
import { zip } from 'lodash';
import { Direction, PageLink } from '@app/shared/public-api';

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
  implements OnInit, OnChanges, OnDestroy, AfterViewInit
{
  @Input() deviceId: string;

  @Input() Attributes: string[];

  @Input() forecastId: string;

  @Input() forecastData: any; // Forecast data from parent component

  @Input() forecastMaxSteps: number; // Number of forecast points

  @Input() selectedSensor = 'rotate'; // Currently selected sensor (from parent viewPreferences)

  @Output() sensorChanged = new EventEmitter<string>();

  // Sensor selection
  availableSensors = ['rotate', 'pressure', 'vibration', 'volt'];

  // Sensor color mapping for consistent chart colors
  sensorColors = {
    rotate: '#FF6B6B',      // Red
    pressure: '#4ECDC4',    // Teal
    vibration: '#FFD93D',   // Yellow
    volt: '#6BCF7F'         // Green
  };

  // UI State properties
  isExpanded = false;

  isRefreshing = false;

  isRealtimeMode = true;

  isHistoryMode = false;

  hasNoData = false;

  noDataMessage = 'No data available';

  // Date picker properties
  startDate: Date = new Date();

  endDate: Date = new Date();

  // Selection properties
  selected = { value: '1h', name: 'Last 1 hour' };

  selectionOptions = [
    { value: '1h', name: 'Last 1 hour' },
    { value: '6h', name: 'Last 6 hours' },
    { value: '12h', name: 'Last 12 hours' },
    { value: '24h', name: 'Last 24 hours' },
    { value: '7d', name: 'Last 7 days' },
    { value: '30d', name: 'Last 30 days' },
  ];

  // Chart instance
  private chart: echarts.ECharts;

  private updateInterval: any;

  private timeOffset = 0; // Track time offset for shifting data

  private resizeObserver: ResizeObserver;

  // save old data to merge with new forecast data
  private pressureData: [number, number][] = [];

  private rotateData: [number, number][] = [];

  private vibrationData: [number, number][] = [];

  private voltData: [number, number][] = [];

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private predictiveModelsService: PredictiveModelsService,
    private modelWebSocketService: ModelWebSocketService
  ) {
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
      CanvasRenderer,
      UniversalTransition
    ]);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle changes to input properties
    if (changes.forecastData && changes.forecastData.currentValue) {
      console.log('Forecast data changed:', changes.forecastData);
      console.log('Chart initialized?', !!this.chart);
      console.log('Data structure:', changes.forecastData.currentValue);
      this.updateChartWithForecastData(changes.forecastData.currentValue);
    }

    // Handle sensor selection changes from parent
    if (changes.selectedSensor && !changes.selectedSensor.firstChange && this.chart) {
      console.log('Selected sensor changed to:', changes.selectedSensor.currentValue);
      this.updateChartForSelectedSensor();
    }
  }

  ngOnInit(): void {
    // Subscribe to forecast data updates via WebSocket
    if (this.forecastId) {
      // this.subscribeToForecastUpdates();
      // initialize chart
      this.chart = echarts.init(
        document.getElementById('chart') as HTMLElement,
        this.isDarkTheme() ? 'dark' : 'light'
      );
      // set initial options - show only selected sensor
      const sensorName = this.selectedSensor.charAt(0).toUpperCase() + this.selectedSensor.slice(1);
      const sensorDataMap = {
        rotate: this.rotateData,
        pressure: this.pressureData,
        vibration: this.vibrationData,
        volt: this.voltData
      };
      const selectedData = sensorDataMap[this.selectedSensor] || [];
      const sensorColor = this.sensorColors[this.selectedSensor];

      this.chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: 'Forecast Chart',
          left: 'center',
        },
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          data: [sensorName],
          top: 30,
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          scale: true,
        },
        dataZoom: [
          {
            type: 'inside',
            start: 0,
            end: 100,
          },
          {
            start: 0,
            end: 100,
          },
        ],
        series: [
          {
            name: sensorName,
            type: 'line',
            showSymbol: false,
            data: selectedData,
            itemStyle: {
              color: sensorColor
            },
            lineStyle: {
              color: sensorColor,
              width: 2
            }
          },
        ],
      });
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy(): void {
    // Clear interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    // Dispose chart
    if (this.chart) {
      this.chart.dispose();
    }
  }

  ngAfterViewInit(): void {
    // this.initializeChartWithSampleData();
    // this.startAutoUpdate();
    this.setupResizeObserver();
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  // refresh chart data
  refreshChart(): void {
  }

  toggleMode(): void {
    this.isRealtimeMode = !this.isRealtimeMode;
    this.isHistoryMode = !this.isHistoryMode;

    // In realtime mode, enable auto-update; in history mode, disable it
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.isRealtimeMode) {
      // Reset time offset when switching to realtime mode
      this.timeOffset = 0;
      // this.startAutoUpdate();
    }
  }

  // Sensor selection methods
  onSensorChange(sensor: string): void {
    this.selectedSensor = sensor;
    // Update chart to show only selected sensor
    this.updateChartForSelectedSensor();
    // Emit event to parent to save preference
    this.saveSensorPreference();
  }

  getSensorColor(sensor: string): string {
    return this.sensorColors[sensor] || '#666';
  }

  private saveSensorPreference(): void {
    // Emit event to parent component to save to viewPreferences
    this.sensorChanged.emit(this.selectedSensor);
  }

  private updateChartForSelectedSensor(): void {
    if (!this.chart) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      // Get the data for the selected sensor
      const sensorDataMap = {
        rotate: this.rotateData,
        pressure: this.pressureData,
        vibration: this.vibrationData,
        volt: this.voltData
      };

      const selectedData = sensorDataMap[this.selectedSensor] || [];
      const sensorName = this.selectedSensor.charAt(0).toUpperCase() + this.selectedSensor.slice(1);
      const sensorColor = this.sensorColors[this.selectedSensor];

      // Update chart to show only the selected sensor
      this.chart.setOption({
        legend: {
          data: [sensorName],
          top: 30,
        },
        series: [
          {
            name: sensorName,
            type: 'line',
            showSymbol: false,
            data: selectedData,
            itemStyle: {
              color: sensorColor
            },
            lineStyle: {
              color: sensorColor,
              width: 2
            }
          },
        ],
      });

      this.chart.resize();
    });
  }

  // Time selection methods
  onSelectTimeChange(event: { value: string }): void {
    const option = this.selectionOptions.find(opt => opt.value === event.value);
    if (option) {
      this.selected = option;
      // TODO: Implement time range change logic
    }
  }

  // Date picker methods
  updateEndDate(): void {
    if (this.endDate) {
      // TODO: Implement end date update logic
    }
  }

  toggleDatePicker(datepicker: any): void {
    datepicker.open();
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
    // Update start date with selected time
    if (dateStartRange.selected) {
      this.startDate = new Date(dateStartRange.selected);
      this.startDate.setHours(parseInt(startDateHours.value || '0', 10));
      this.startDate.setMinutes(parseInt(startDateMinutes.value || '0', 10));
      this.startDate.setSeconds(parseInt(startDateSeconds.value || '0', 10));
    }

    // Update end date with selected time
    if (dateEndRange.selected) {
      this.endDate = new Date(dateEndRange.selected);
      this.endDate.setHours(parseInt(endDateHours.value || '0', 10));
      this.endDate.setMinutes(parseInt(endDateMinutes.value || '0', 10));
      this.endDate.setSeconds(parseInt(endDateSeconds.value || '0', 10));
    }

    // TODO: Implement history time change logic
  }

  // Time picker helper methods
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

  private setupResizeObserver(): void {
    const chartElement = document.getElementById('chart');
    if (chartElement && this.chart) {
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.runOutsideAngular(() => {
          if (this.chart) {
            this.chart.resize();
          }
        });
      });
      this.resizeObserver.observe(chartElement);
    }
  }

private updateChartWithForecastData(data: ForecastSensorPredictions): void {
    console.log('updateChartWithForecastData called with:', data);
    console.log('Chart exists?', !!this.chart);

    if (!this.chart || !data) {
      console.warn('Chart not initialized or no data provided');
      return;
    }

    this.zone.runOutsideAngular(() => {
      // Parse forecast data and update chart
      // Expected data format: { result: [...], timestamps: [...], predictions: [...] }

      console.log('Updating chart data...');
      console.log('Data keys:', Object.keys(data));
      console.log('rotate data:', data.rotate);
      console.log('pressure data:', data.pressure);

      // Merge new data and sort by timestamp to ensure proper line rendering
      this.rotateData = [...this.rotateData, ...data.rotate.forecast.map<[number, number]>((v, i) => [data.rotate.timestamp[i], v])]
        .sort((a, b) => a[0] - b[0]);

      this.pressureData = [...this.pressureData, ...data.pressure.forecast.map<[number, number]>((v, i) => [data.pressure.timestamp[i], v])]
        .sort((a, b) => a[0] - b[0]);

      this.vibrationData = [...this.vibrationData, ...data.vibration.forecast.map<[number, number]>((v, i) => [data.vibration.timestamp[i], v])]
        .sort((a, b) => a[0] - b[0]);

      this.voltData = [...this.voltData, ...data.volt.forecast.map<[number, number]>((v, i) => [data.volt.timestamp[i], v])]
        .sort((a, b) => a[0] - b[0]);

      console.log('rotateData length:', this.rotateData.length);
      console.log('pressureData length:', this.pressureData.length);
      console.log('Sample rotateData:', this.rotateData.slice(-5));

      if (data) {
        console.log('Setting chart options...');

        // Update chart to show only the selected sensor
        const sensorDataMap = {
          rotate: this.rotateData,
          pressure: this.pressureData,
          vibration: this.vibrationData,
          volt: this.voltData
        };

        const selectedData = sensorDataMap[this.selectedSensor] || [];
        const sensorName = this.selectedSensor.charAt(0).toUpperCase() + this.selectedSensor.slice(1);
        const sensorColor = this.sensorColors[this.selectedSensor];

        this.chart.setOption({
          legend: {
            data: [sensorName],
            top: 30,
          },
          series: [
            {
              name: sensorName,
              data: selectedData,
              itemStyle: {
                color: sensorColor
              },
              lineStyle: {
                color: sensorColor,
                width: 2
              }
            },
          ],
        });
        this.hasNoData = false;
        // render chart
        this.chart.resize();
        console.log('Chart updated and resized for sensor:', this.selectedSensor);
      }
    });
  }

  // Chart initialization and data methods
  private isDarkTheme(): boolean {
    // Check if dark theme is enabled by inspecting the body class
    return document.body.classList.contains('tb-dark') ||
           document.body.classList.contains('dark-theme') ||
           document.documentElement.classList.contains('tb-dark') ||
           document.documentElement.classList.contains('dark-theme');
  }
}
