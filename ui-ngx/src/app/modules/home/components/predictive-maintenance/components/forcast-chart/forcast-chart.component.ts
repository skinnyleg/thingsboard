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
  public series = [];
  public oldForecastSeries = {};

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

  handleTimeChangeDate() {
    this.chartInstance.setOption({
      series: [
        {
          name: "Pressure",
          type: "line",
          color: ["#FF5733"],
          symbol: 'none',
          data: [],
        },
        {
          name: "Pressure Forecast",
          type: "line",
          color: ["#0000FF50"],
          symbol: 'none',
          data: [],
        },
        {
          name: "Pressure Historical Forecast",
          type: "line",
          color: ["#989898"],
          symbol: 'none',
          data: [],
        }
      ],
      animation: false,
      legend: {
      }
    })
    this.oldForecastSeries["pressure"] = [];
    this.getHistoricalData().then((data) => {
      data["pressure"].sort((a, b) => a.ts - b.ts)
      this.chartInstance.setOption({
        series: [
          {
            name: "Pressure",
            data: data["pressure"].map((e) => [e.ts, parseFloat(e.value)]),
          },
        ],
      });
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
        // return;
        let data;
        try {
          data = JSON.parse(msg);
        } catch { }
        if (data && this.displayData) {
          Object.keys(data.data).forEach((key) => {
            if (key === "datetime") return;
            let values = data.data[key].map(([x, y]) => [x, parseFloat(y)]);
            const series = this.chartInstance.getOption().series;
            let keyIndex = series.findIndex(
              (series) => series.name.toLowerCase() === key.toLowerCase()
            );
            let keyForecastIndex = series.findIndex(
              (series) =>
                series.name.toLowerCase() === key.toLowerCase() + " forecast"
            );
            values = series[keyIndex].data.concat(values);
            values.sort((a, b) => a[0] - b[0]);
            // values = values
            //   // .slice(-this.forecast_chart_seconds_away)
            //   .filter(
            //     (point) => Date.now() - +new Date(point.x) <= 2 * this.selected.seconds * 1000
            //   );
            let forecast = values.length ? [values[values.length - 1]] : [];
            if (values.length) {
              let currentDate = values[values.length - 1][0];
              forecast = [
                ...forecast,
                ...data.forecast[key].map((point) => {
                  currentDate += 1000;
                  return [
                    currentDate,
                    point,
                  ];
                }),
              ];
            }
            if (series[keyForecastIndex].data.length) {
              this.oldForecastSeries[key].push([
                values[values.length - 1][0],
                series[keyForecastIndex].data[
                series[keyForecastIndex].data.length - 20
                ][1]
              ]);
              // this.oldForecastSeries[key] = this.oldForecastSeries[key]
              // .slice(-this.forecast_chart_seconds_away)
              // .filter(
              //   (point) => Date.now() - +new Date(point.x) <= 2 * this.selected.seconds * 1000
              // );
            }
            this.chartInstance.setOption({
              series: [
                {
                  name: "Pressure",
                  data: values
                },
                {
                  name: "Pressure Forecast",
                  data: forecast,
                },
                {
                  name: "Pressure Historical Forecast",
                  data: this.oldForecastSeries[key]
                }
              ],
            })
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
      const chart = document.getElementById("chart");
      echarts.use([
        TitleComponent,
        ToolboxComponent,
        TooltipComponent,
        GridComponent,
        DataZoomComponent,
        LineChart,
        CanvasRenderer,
        UniversalTransition,
        LegendComponent,
      ]);
      this.chartInstance = echarts.init(chart);
      let base = +new Date(1968, 9, 3);
      let oneDay = 24 * 3600 * 1000;
      let date = [];
      let data = [Math.random() * 300];
      for (let i = 1; i < 20000; i++) {
        var now = new Date((base += oneDay));
        date.push([now.getFullYear(), now.getMonth() + 1, now.getDate()].join('/'));
        data.push(Math.round((Math.random() - 0.5) * 20 + data[i - 1]));
      }
      const option = {
        tooltip: {
          trigger: 'axis',
          position: function (pt) {
            return [pt[0], '10%'];
          }
        },
        title: {
          align: 'left',
          x: 10,
          text: 'Forecast Chart'
        },
        toolbox: {
          feature: {
            dataZoom: {
              yAxisIndex: 'none'
            },
            restore: {},
            saveAsImage: {}
          }
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          boundaryGap: [0, '100%']
        },
        dataZoom: [
          {
            type: 'inside',
            start: 0,
            end: 100
          },
          {
            start: 0,
            end: 100
          }
        ],
      };
      this.chartInstance.setOption(option);
      window.onresize = () => {
        this.chartInstance.resize();
      }
      this.handleTimeChangeDate();
    }
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    clearInterval(this.setIntervalId);
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
