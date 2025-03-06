import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import { AttributeService } from "@core/http/attribute.service";
import { TelemetryWebsocketService } from "@core/ws/telemetry-websocket.service";
import { AttributeDatasource } from "@home/models/datasource/attribute-datasource";
import { TranslateService } from "@ngx-translate/core";
import { EntityId } from "@shared/models/id/entity-id";
import {
  TelemetryType,
} from "@shared/models/telemetry/telemetry.models";
import { Subject } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { MatInputModule, } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import ApexCharts from "apexcharts";

type ApexAxisChartSeriesWithXYData = {
  [K in keyof ApexAxisChartSeries[number]]: K extends "data"
  ? { x: number; y: number }[]
  : ApexAxisChartSeries[number][K];
}[];

const selectionOptions = [
  {
    value: "60s",
    name: "Last 60 seconds",
    seconds: 60,
    interval: 1000,
  },
  {
    value: "5min",
    name: "Last 5 minutes",
    seconds: 5 * 60,
    interval: 1000,
  },
  {
    value: "10min",
    name: "Last 10 minutes",
    seconds: 10 * 60,
    interval: 1000,
  },
  {
    value: "1hour",
    name: "Last 1 hour",
    seconds: 60 * 60,
    interval: 60 * 1000,
  },
  {
    value: "12hours",
    name: "Last 12 hours",
    seconds: 12 * 60 * 60,
    interval: 10 * 60 * 1000,
  },
  {
    value: "1day",
    name: "Last 1 day",
    seconds: 24 * 60 * 60,
    interval: 10 * 60 * 1000,
  },
  {
    value: "5day",
    name: "Last 5 days",
    seconds: 5 * 24 * 60 * 60,
    interval: 30 * 60 * 1000
  },
  {
    value: "10day",
    name: "Last 10 days",
    seconds: 10 * 24 * 60 * 60,
    interval: 60 * 60 * 1000,
  },
  {
    value: "15days",
    name: "Last 15 days",
    seconds: 15 * 24 * 60 * 60,
    interval: 60 * 60 * 1000,
  },
  {
    value: "1month",
    name: "Last 1 month",
    seconds: 30 * 24 * 60 * 60,
    interval: 12 * 60 * 60 * 1000,
  },
  {
    value: "2month",
    name: "Last 2 months",
    seconds: 2 * 30 * 24 * 60 * 60,
    interval: 12 * 60 * 60 * 1000
  },
];

@Component({
  selector: "tb-forcast-chart",
  templateUrl: "./forcast-chart.component.html",
  styleUrls: ["./forcast-chart.component.scss"],
  standalone: true,
  imports: [CommonModule, MatInputModule, MatSelectModule, MatFormFieldModule, FormsModule],
})
export class ForcastChartComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  public oldForecastSeries: {
    [key: string]: ApexAxisChartSeriesWithXYData[number]["data"];
  } = {};
  public forecastWs: WebSocketSubject<any>;

  public selected = selectionOptions.find((a) => a.seconds === 60)

  public telemetryData: any[] = [];
  public seriesHidden: number[] = [];
  private originalSeriesData: { [key: number]: any[] } = {};
  private destroy$ = new Subject<void>();
  @Input() deviceId: string;
  @Input() Attributes: string[];
  @Input() forecastId: string;

  entityId: EntityId;
  attributeScope: TelemetryType;
  dataSource: AttributeDatasource;
  displayData: boolean = true;
  public forecast_chart_seconds_away = 60;
  setIntervalId: number;
  public chartInstance;
  public selectionOptions = selectionOptions;
  public series: ApexAxisChartSeriesWithXYData = [];
  public lastZoom;

  public chart: ApexChart = {
    id: "realtime",
    type: "area",
    stacked: false,
    height: '100%',
    zoom: {
      type: "x",
      enabled: true,
      autoScaleYaxis: true,
    },
    toolbar: {
      show: true,
      tools: {
        download: false,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
      export: {
        csv: {
          filename: 'history_chart_' + new Date().toString(),
          columnDelimiter: ',',
        }
      }
    },
    events: {
      beforeResetZoom: () => {
        this.lastZoom = null;
      },
      zoomed: (_, value) => {
        this.lastZoom = [value.xaxis.min, value.xaxis.max];
      },
      legendClick: (chart, seriesIndex, options) => {
        if (this.seriesHidden.includes(seriesIndex)) {
          this.seriesHidden = this.seriesHidden.filter(
            (i) => i !== seriesIndex
          );
          this.series[seriesIndex].data =
            this.originalSeriesData[seriesIndex];
        } else {
          this.seriesHidden.push(seriesIndex);
          this.originalSeriesData[seriesIndex] = [
            ...this.series[seriesIndex].data,
          ];
          this.series[seriesIndex].data = [];
        }
      },
    },
    animations: {
      enabled: false,
    },
  };

  public stroke: ApexStroke = {
    curve: "straight",
    width: 2,
  };

  public dataLabels: ApexDataLabels = {
    enabled: false,
  };

  public markers: ApexMarkers = {
    size: 0,
  };

  public legend: ApexLegend = {
    show: true,
    showForSingleSeries: true,
    showForNullSeries: true,
    showForZeroSeries: true,
  };

  public title: ApexTitleSubtitle = {
    text: "Forcast Over Time",
    align: "left",
  };

  public fill: ApexFill = {
    type: "gradient",
    gradient: {
      shadeIntensity: 1,
      inverseColors: false,
      opacityFrom: 0.5,
      opacityTo: 0,
      stops: [0, 90, 100],
    },
  };

  public yaxis: ApexYAxis = {
    labels: {
      formatter: function (val) {
        if (val === undefined) return;
        return val.toFixed(2);
      },
    },
    title: {
      text: "Values",
    },
    min: 10,
    max: 160,
  };

  public xaxis: ApexXAxis = {
    type: "datetime",
    labels: {
      datetimeFormatter: {
        year: "yyyy",
        month: "MMM 'yy",
        day: "dd MMM",
        hour: "HH:mm",
        minute: "HH:mm:ss",
      },
      formatter: (value: string, timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      },
    },
  };

  public tooltip: ApexTooltip = {
    shared: false,
    y: {
      formatter: function (val) {
        if (val === undefined) return;
        return `${val.toFixed(2)} °C`;
      },
    },
  }

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone
  ) {
  }

  ngAfterViewInit() { }

  onSelectTimeChange(event) {
    this.selected = { ...selectionOptions.find((i) => i.value === event.value) };
    this.handleTimeChangeDate();
  }

  updateSeries(series) {
    this.chartInstance.updateSeries(series);
    if (this.lastZoom) {
      this.chartInstance.zoomX(this.lastZoom[0], this.lastZoom[1])

    }
  }

  handleTimeChangeDate() {
    this.getHistoricalData().then((data) => {
      this.series = [
        {
          name: "Pressure",
          data: data["pressure"].map((e) => ({ x: e.ts, y: parseFloat(e.value) })),
          color: "#FF5733",
        }
      ]
      this.updateSeries(this.series);
      this.connectToSocket();
    })
  }

  async getHistoricalData() {
    const startTs = Math.floor(Date.now() / 1000 - this.selected.seconds - 60);
    const history = (this.selected.seconds + 60);
    const interval = this.selected.interval;
    // const interval = 1000
    const agg = "AVG";
    const limit = 100;

    const headers = {
      'x-authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
      'content-type': 'application/json',
    }
    const forecast = await fetch('/api/forecasts/' + this.forecastId, { headers })
      .then(async (res) => !res.ok ? ({ error: res.statusText }) : ({ data: await res.json() }))
      .catch((err) => ({ error: err }));
    if (forecast.error) return Promise.reject(forecast.error);
    // @ts-ignore
    const device_id = forecast.data.deviceId?.id;
    if (typeof device_id != 'string') return Promise.reject("Didnt find device Id");
    return await fetch(
      `/api/plugins/telemetry/DEVICE/${device_id}/values/timeseries?`
      + 'keys=pressure&startTs=' + (startTs * 1000)
      + '&endTs=' + Date.now()
      + '&interval=' + interval
      + '&limit=' + limit
      + '&agg=' + agg
      , { headers })
      .then(async (res) => await res.json())
  }

  connectToSocket() {
    this.forecastWs = webSocket({
      url:
        "ws://localhost:8000/forecast/" +
        this.forecastId +
        "/ws?token=" +
        localStorage.getItem("jwt_token") +
        "&startTs=" + (Date.now() - (this.forecast_chart_seconds_away + 60) * 1000),
      deserializer: (e) => e.data,
      openObserver: {
        next: () => { },
      },
    });
    this.forecastWs.subscribe({
      next: (msg) => {
        let data;
        try {
          data = JSON.parse(msg);
        } catch { }
        if (data && this.displayData) {
          Object.keys(data.data).forEach((key) => {
            if (key === "datetime") return;
            let values = data.data[key].map(([x, y]) => ({
              x,
              y: parseFloat(y),
            }));
            let keyIndex = this.series.findIndex(
              (series) => series.name.toLowerCase() === key.toLowerCase()
            );
            let keyForecastIndex = this.series.findIndex(
              (series) =>
                series.name.toLowerCase() === key.toLowerCase() + " forecast"
            );
            let keyOldForecastIndex = this.series.findIndex(
              (series) =>
                series.name.toLowerCase() ===
                key.toLowerCase() + " measured forecast"
            );
            if (keyIndex === -1) {
              this.series.push({
                name: key,
                data: [],
                color: "#FF5733",
              });
              keyIndex = this.series.length - 1;
            }
            if (keyForecastIndex === -1) {
              this.series.push({
                name: key[0].toUpperCase() + key.slice(1) + " Forecast",
                data: [],
                color: "#0000FF50",
              });
              keyForecastIndex = this.series.length - 1;
            }
            if (keyOldForecastIndex === -1) {
              this.series.push({
                name:
                  key[0].toUpperCase() + key.slice(1) + " Measured Forecast",
                data: [],
                color: "#989898",
              });
              keyOldForecastIndex = this.series.length - 1;
              this.oldForecastSeries[key] = [];
              this.updateDashArray();
            }
            this.series[keyIndex].data = this.series[keyIndex].data.concat(values);
            this.series[keyIndex].data.sort((a, b) => a.x - b.x);
            // values = values
            //   // .slice(-this.forecast_chart_seconds_away)
            //   .filter(
            //     (point) => Date.now() - +new Date(point.x) <= 2 * this.selected.seconds * 1000
            //   );
            values = this.series[keyIndex].data;
            let forecast = values.length ? [values[values.length - 1]] : [];
            if (values.length) {
              let currentDate = values[values.length - 1].x;
              forecast = [
                ...forecast,
                ...data.forecast[key].map((point) => {
                  currentDate += 1000;
                  return {
                    x: currentDate,
                    y: point,
                  };
                }),
              ];
            }
            if (this.series[keyForecastIndex].data.length) {
              this.oldForecastSeries[key].push({
                x: values[values.length - 1].x,
                y: this.series[keyForecastIndex].data[
                  this.series[keyForecastIndex].data.length - 20
                ].y,
              });
              // this.oldForecastSeries[key] = this.oldForecastSeries[key]
              //   // .slice(-this.forecast_chart_seconds_away)
              //   .filter(
              //     (point) => Date.now() - +new Date(point.x) <= 2 * this.selected.seconds * 1000
              //   );
            }
            this.series = this.series.map((series, index) => {
              switch (index) {
                case keyForecastIndex:
                  return { ...series, data: forecast };
                case keyOldForecastIndex:
                  return { ...series, data: this.oldForecastSeries[key] };
                default:
                  return series;
              }
            });
            this.updateSeries(this.series);
          });
        }
      },
      error: (err) => { },
      complete: () => { },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.deviceId &&
      this.deviceId &&
      changes.Attributes &&
      this.Attributes &&
      this.forecastId
    ) {
      this.chartInstance = new ApexCharts(document.querySelector('#chart'), {
        chart: this.chart,
        stroke: this.stroke,
        dataLabels: this.dataLabels,
        markers: this.markers,
        legend: this.legend,
        title: this.title,
        fill: this.fill,
        yaxis: this.yaxis,
        xaxis: this.xaxis,
        tooltip: this.tooltip,
        series: this.series,
      })
      this.chartInstance.render();
      this.handleTimeChangeDate();
    }
  }

  ngOnInit(): void { }

  updateDashArray() {
    this.stroke = {
      ...this.stroke,
      dashArray: this.series.map((series) =>
        series.name.toLowerCase().includes("forecast") ? 8 : 0
      ),
    };
  }

  ngOnDestroy(): void {
    clearInterval(this.setIntervalId);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
