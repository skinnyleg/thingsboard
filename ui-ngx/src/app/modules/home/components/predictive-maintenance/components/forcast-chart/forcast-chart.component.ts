import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectorRef,
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
import { TelemetryType } from "@shared/models/telemetry/telemetry.models";
import { Subject } from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { FormsModule } from "@angular/forms";
import ApexCharts from "apexcharts";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import * as echarts from "echarts/core";
import {
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  MarkAreaComponent,
} from "echarts/components";
import { LineChart, ScatterChart } from "echarts/charts";
import { UniversalTransition } from "echarts/features";
import { MatButtonModule } from "@angular/material/button";
import { CanvasRenderer } from "echarts/renderers";
import { MatIconModule } from "@angular/material/icon";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { FormControl } from "@angular/forms";
import { FormGroup } from "@material-ui/core";
import { environment } from "@env/environment";

const Hours = Array.from(Array(24), (_, i) =>
  i < 10 ? "0" + i : i.toString()
);
const Minutes = Array.from(Array(60), (_, i) =>
  i < 10 ? "0" + i : i.toString()
);
const Seconds = Array.from(Minutes);

const getAlarmSubscriptionCmd = (token, device_id) => ({
  authCmd: {
    cmdId: 0,
    token: token,
  },
  cmds: [
    {
      type: "ALARM_DATA",
      query: {
        entityFilter: {
          type: "singleEntity",
          singleEntity: {
            entityType: "DEVICE",
            id: device_id,
          },
        },
        pageLink: {
          page: 0,
          pageSize: 10,
          textSearch: null,
          typeList: [],
          severityList: [],
          statusList: ["ACTIVE", "CLEARED"],
          searchPropagatedAlarms: false,
          sortOrder: {
            key: {
              key: "createdTime",
              type: "ALARM_FIELD",
            },
            direction: "DESC",
          },
          timeWindow: 2592000000,
        },
        alarmFields: [
          {
            type: "ALARM_FIELD",
            key: "createdTime",
          },
          {
            type: "ALARM_FIELD",
            key: "originator",
          },
          {
            type: "ALARM_FIELD",
            key: "type",
          },
          {
            type: "ALARM_FIELD",
            key: "severity",
          },
          {
            type: "ALARM_FIELD",
            key: "type",
          },
          {
            type: "ALARM_FIELD",
            key: "status",
          },
        ],
        entityFields: [],
        latestValues: [],
      },
      cmdId: 3,
    },
  ],
});

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
    interval: 30 * 60 * 1000,
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
    interval: 12 * 60 * 60 * 1000,
  },
];

@Component({
  selector: "tb-forcast-chart",
  templateUrl: "./forcast-chart.component.html",
  styleUrls: ["./forcast-chart.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
  ],
})
export class ForcastChartComponent
  implements OnInit, OnChanges, OnDestroy, AfterViewInit
{
  public forecastWs: WebSocketSubject<any>;
  public dataWs: WebSocketSubject<any>;

  public selected = { ...selectionOptions.find((a) => a.seconds === 60) };

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

  startDate = new Date(+new Date() - 60 * 60 * 1000);
  endDate = new Date();
  startDateHours = Hours[0];
  startDateMinutes = Minutes[0];
  startDateSeconds = Seconds[0];

  endDateHours = Hours[0];
  endDateMinutes = Minutes[0];
  endDateSeconds = Seconds[0];

  public getHours() {
    return Array.from(Hours);
  }

  public getMinutes() {
    return Array.from(Minutes);
  }

  public getSeconds() {
    return Array.from(Seconds);
  }

  graphtype = "realtime";
  public isHistoryMode = false;
  public isRealtimeMode = true;

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  handleHistoryTimeChange(
    start,
    end,
    shours,
    smin,
    sseconds,
    ehours,
    emin,
    eseconds
  ) {
    start = new Date(start.selected);
    end = new Date(end.selected);
    start.setHours(+shours.value, +smin.value, +sseconds.value);
    end.setHours(+ehours.value, +emin.value, +eseconds.value);
    if (!+end) {
      return alert("Invalid Start Date");
    }
    if (!+end) {
      return alert("Invalid End Date");
    }
    this.startDate = start;
    this.endDate = end;
    this.handleTimeChangeDate();
  }

  updateEndDate() {
    this.endDate = new Date();
    this.handleTimeChangeDate();
  }

  toggleDatePicker(el) {
    el.style.display = el.style.display === "block" ? "none" : "block";
  }

  ngAfterViewInit() {}

  onSelectTimeChange(event) {
    this.selected = {
      ...selectionOptions.find((i) => i.value === event.value),
    };
    this.handleTimeChangeDate();
  }

  handleGraphChange(event) {
    this.graphtype = event.value;
    this.isHistoryMode = event.value === "history";
    this.isRealtimeMode = event.value === "realtime";
    // Trigger change detection to prevent ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.handleTimeChangeDate();
      this.cdr.detectChanges();
    });
  }

  handleTimeChangeDate() {
    if (this.forecastWs) {
      this.forecastWs.complete();
    }
    if (this.alarmsWs$) {
      this.alarmsWs$.complete();
    }
    if (this.graphtype === "history") {
      this.chartInstance.setOption({
        xAxis: {
          min: +this.startDate,
          max: +this.endDate,
        },
      });
    } else {
      this.chartInstance.setOption({
        xAxis: {
          min: "dataMin",
          max: "dataMax",
        },
      });
    }
    const history_series = [
      {
        name: "Pressure",
        type: "line",
        color: ["#FF5733"],
        symbol: "none",
        data: [],
      },
      {
        name: "Pressure Historical Forecast",
        type: "line",
        color: ["#989898"],
        symbol: "none",
        data: [],
      },
    ];
    const realtime_series = [
      {
        name: "Pressure",
        type: "line",
        color: ["#FF5733"],
        symbol: "none",
        data: [],
      },
      {
        name: "Pressure Forecast",
        type: "line",
        color: ["#0000FF50"],
        symbol: "none",
        data: [],
      },
      {
        name: "Pressure Historical Forecast",
        type: "line",
        color: ["#989898"],
        symbol: "none",
        data: [],
      },
    ];
    if (this.graphtype === "history") {
      this.chartInstance.setOption(
        {
          series: history_series,
          legend: {},
        },
        {
          replaceMerge: ["series"],
        }
      );
    } else {
      this.chartInstance.setOption(
        {
          series: realtime_series,
          legend: {},
        },
        {
          replaceMerge: ["series"],
        }
      );
    }
    this.oldForecastSeries["pressure"] = [];
    this.getHistoricalData().then(([history, alarms]) => {
      if (!history?.pressure) {
        // return alert("No Data Found.");
      }
      history["pressure"].sort((a, b) => a.ts - b.ts);
      this.chartInstance.setOption({
        series: [
          {
            name: "Pressure",
            data: history["pressure"].map((e) => [e.ts, parseFloat(e.value)]),
            type: "line",
            markArea: {
              itemStyle: {
                color: "rgba(255, 173, 177, 0.4)",
              },
              data: alarms.data.map((alarm) => [
                { xAxis: alarm.startTs },
                { xAxis: alarm.endTs },
              ]),
            },
          },
          {
            name: "Pressure Historical Forecast",
            data: history["forecast"].map((e) => [e.ts, parseFloat(e.value)]),
            type: "line",
          },
        ],
      });
      if (this.graphtype === "realtime") {
        this.getAlarms();
        this.connectToSocket();
      }
    });
  }

  async getHistoricalData() {
    let startTs;
    if (this.graphtype === "realtime") {
      startTs = Math.floor(Date.now() / 1000 - this.selected.seconds) * 1000;
    } else {
      startTs = +this.startDate;
    }
    let endTs;
    if (this.graphtype === "realtime") {
      endTs = +new Date();
    } else {
      endTs = +this.endDate;
    }
    const history = this.selected.seconds + 60;
    const agg = "AVG";
    const limit = 500;
    let interval;
    if (this.graphtype === "realtime") {
      interval = Math.floor((this.selected.seconds * 1000) / limit);
    } else {
      interval = Math.floor((+this.endDate - +this.startDate) / limit);
    }

    const headers = {
      "x-authorization": "Bearer " + localStorage.getItem("jwt_token"),
      "content-type": "application/json",
    };
    const forecast = await fetch("/api/forecasts/" + this.forecastId, {
      headers,
    })
      .then(async (res) =>
        !res.ok ? { error: res.statusText } : { data: await res.json() }
      )
      .catch((err) => ({ error: err }));
    if (forecast.error) return Promise.reject(forecast.error);
    // @ts-ignore
    const device_id = forecast.data.deviceId?.id;
    if (typeof device_id != "string")
      return Promise.reject("Didnt find device Id");
    return await Promise.all([
      fetch(
        `/api/plugins/telemetry/DEVICE/${device_id}/values/timeseries?` +
          "keys=pressure,forecast&startTs=" +
          startTs +
          "&endTs=" +
          endTs +
          "&interval=" +
          interval +
          "&limit=" +
          limit +
          "&agg=" +
          agg,
        { headers }
      ),
      fetch(
        "/api/alarm/DEVICE/" +
          device_id +
          "?pageSize=1&page=0&sortProperty=createdTime",
        { headers }
      ),
    ]).then(async ([history, alarms]) => [
      await history.json(),
      await alarms.json(),
    ]);
  }

  alarmsWs$;

  async getAlarms() {
    const token = localStorage.getItem("jwt_token");
    const headers = {
      "x-authorization": "Bearer " + token,
      "content-type": "application/json",
    };
    const forecast = await fetch("/api/forecasts/" + this.forecastId, {
      headers,
    })
      .then(async (res) =>
        !res.ok ? { error: res.statusText } : { data: await res.json() }
      )
      .catch((err) => ({ error: err }));
    if (forecast.error) return Promise.reject(forecast.error);
    // @ts-ignore
    const device_id = forecast.data.deviceId?.id;
    if (typeof device_id != "string")
      return Promise.reject("Didnt find device id");
    this.alarmsWs$ = webSocket({
      url: "/api/ws",
      // deserializer: (e) => e.data,
      openObserver: {
        next: (e) => {},
      },
    });
    this.alarmsWs$.next(getAlarmSubscriptionCmd(token, device_id));
    const alarms = new Map();
    this.alarmsWs$.subscribe({
      next: (msg) => {
        const data = msg.data?.data ?? msg.update;
        console.log({ data });
        data.forEach((alarm) => alarms.set(alarm.id.id, alarm));
        const areas = Array.from(alarms.values()).map((alarm) => [
          { xAxis: alarm.startTs },
          { xAxis: alarm.endTs },
        ]);
        this.chartInstance.setOption({
          series: [
            {
              name: "Pressure",
              markArea: {
                itemStyle: {
                  color: "rgba(255, 173, 177, 0.4)",
                },
                data: areas,
              },
            },
          ],
        });
      },
    });
  }

  async connectToSocket() {
    const series = this.chartInstance.getOption().series;
    let pressureData = [
      ...series.find((e) => e.name.toLowerCase() == "pressure").data,
    ];
    let historyForecastData = [
      ...series.find(
        (e) => e.name.toLowerCase() == "pressure historical forecast"
      ).data,
    ];
    this.dataWs = webSocket({
      url: "ws://" + environment.host + ":8080/api/ws",
    });
    this.dataWs.subscribe({
      next: (
        (tmp = null) =>
        (data) => {
          Object.keys(data.data).forEach((key) => {
            let values = data.data[key].map(([x, y]) => [x, parseFloat(y)]);
            values.sort((a, b) => a[0] - b[0]);
            const list = key == "pressure" ? pressureData : historyForecastData;
            if (key == "pressure" && tmp) {
              historyForecastData.push(tmp);
              tmp = null;
            }
            values = list.concat([values[values.length - 1]]);
            values.sort((a, b) => a[0] - b[0]);
            if (key == "forecast") {
              tmp = values.pop();
            }

            values = values.slice(
              -Math.floor(
                (this.selected.seconds / this.selected.interval) * 1000
              ) + 20
            );

            pressureData = key == "pressure" ? values : [...pressureData];
            historyForecastData =
              key == "forecast" ? values : [...historyForecastData];
          });
        }
      )(),
    });
    const headers = {
      "x-authorization": "Bearer " + localStorage.getItem("jwt_token"),
      "content-type": "application/json",
    };
    const forecast = await fetch("/api/forecasts/" + this.forecastId, {
      headers,
    })
      .then(async (res) =>
        !res.ok ? { error: res.statusText } : { data: await res.json() }
      )
      .catch((err) => ({ error: err }));
    if (forecast.error) return Promise.reject(forecast.error);
    // @ts-ignore
    const device_id = forecast.data.deviceId?.id;
    this.dataWs.next({
      authCmd: {
        cmdId: 0,
        token: localStorage.getItem("jwt_token"),
      },
      cmds: [
        {
          cmdId: 10,
          entityType: "DEVICE",
          entityId: device_id,
          keys: "pressure,forecast",
          startTs: Date.now(),
          timeWindow: Date.now(),
          scope: "LATEST_TELEMETRY",
          type: "TIMESERIES",
        },
      ],
    });
    this.forecastWs = webSocket({
      url:
        "ws://" +
        environment.host +
        ":8000/forecast/" +
        this.forecastId +
        "/ws?token=" +
        localStorage.getItem("jwt_token") +
        "&startTs=" +
        (Date.now() - (this.forecast_chart_seconds_away + 60) * 1000),
      deserializer: (e) => e.data,
      openObserver: {
        next: () => {},
      },
    });
    this.forecastWs.subscribe({
      next: (msg) => {
        if (!pressureData.length) return;
        let data;
        try {
          data = JSON.parse(msg);
        } catch {}
        if (data && this.displayData) {
          let currentDate = pressureData[pressureData.length - 1][0];
          let _data = [];
          if (data.forecast["pressure"]) {
            _data = data.forecast["pressure"];
          }
          const values = pressureData;
          let forecast = values.length ? [values[values.length - 1]] : [];
          forecast = forecast.concat(
            _data.map((point) => {
              currentDate += 1000;
              return [currentDate, point];
            })
          );
          // const maxv = historyForecastData.reduce((max, [a]) => Math.max(max, a), -Infinity)
          this.chartInstance.setOption({
            series: [
              {
                name: "Pressure Forecast",
                // data: forecast.filter(([x]) => x >= maxv),
                data: forecast,
                type: "line",
              },
              {
                name: "Pressure",
                data: pressureData,
                type: "line",
              },
              {
                name: "Pressure Historical Forecast",
                data: historyForecastData,
                type: "line",
              },
            ],
          });
        }
      },
      error: (err) => {},
      complete: () => {},
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
        MarkAreaComponent,
        ScatterChart,
      ]);
      this.chartInstance = echarts.init(chart);
      const option = {
        // width: '90%',
        // grid: {
        //   left: '1%',
        // },
        tooltip: {
          trigger: "axis",
          position: function (pt) {
            return [pt[0], "10%"];
          },
        },
        toolbox: {
          right: 50,
          feature: {
            dataZoom: {
              yAxisIndex: "none",
            },
            restore: {},
            saveAsImage: {},
            dataView: {},
            brush: {},
          },
        },
        xAxis: {
          type: "time",
          boundaryGap: false,
          min: null,
          max: null,
        },
        yAxis: {
          type: "value",
          boundaryGap: [0, "100%"],
        },
        dataZoom: [
          {
            type: "inside",
            start: 0,
            end: 100,
          },
          {
            start: 0,
            end: 100,
          },
        ],
        animation: false,
        legend: {
          textStyle: {
            color: "rgba(255, 255, 255, 0.8)",
          },
          inactiveColor: "grey",
        },
      };
      this.chartInstance.setOption(option);
      window.onresize = () => {
        this.chartInstance.resize();
      };
      this.handleTimeChangeDate();
    }
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    clearInterval(this.setIntervalId);
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }
    if (this.alarmsWs$) {
      this.alarmsWs$.complete();
    }
    if (this.forecastWs) {
      this.forecastWs.complete();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
