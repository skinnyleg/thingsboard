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
import { PageLink } from "@shared/models/page/page-link";
import {
  TelemetryType,
} from "@shared/models/telemetry/telemetry.models";
import { Subject } from "rxjs";
import {
  takeUntil,
} from "rxjs/operators";
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

@Component({
  selector: "tb-forcast-chart",
  templateUrl: "./forcast-chart.component.html",
  styleUrls: ["./forcast-chart.component.scss"],
  standalone: true,
  imports: [CommonModule, MatInputModule, MatSelectModule, MatFormFieldModule, FormsModule],
})
export class ForcastChartComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  // ApexChart configuration

  public series: ApexAxisChartSeriesWithXYData = [];
  public chart: ApexChart;
  public dataLabels: ApexDataLabels;
  public markers: ApexMarkers;
  public title: ApexTitleSubtitle;
  public fill: ApexFill;
  public yaxis: ApexYAxis;
  public xaxis: ApexXAxis;
  public tooltip: ApexTooltip;
  public legend: ApexLegend;
  public stroke: ApexStroke;

  public oldForecastSeries: {
    [key: string]: ApexAxisChartSeriesWithXYData[number]["data"];
  } = {};
  public forecastWs: WebSocketSubject<any>;

  public selectionOptions = [
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

  public selected = this.selectionOptions.find((a) => a.seconds === 60)

  onSelectTimeChange(event) {
    // console.log({ "hello": "world", selected: this.selected })
    this.selected = { ...this.selectionOptions.find((i) => i.value === event.value) };
    // console.log({ selected: this.selected, event: event.value })
    this.handleTimeChangeDate();
  }

  handleTimeChangeDate() {
    this.getHistoricalData().then((data) => {
      // console.log(data['pressure']);
      this.series = [
        {
          name: "pressure",
          data: data["pressure"].map((e) => ({ x: e.ts, y: parseFloat(e.value) })),
          color: "#FF5733",
        }
      ]
      this.chartInstance.updateSeries(this.series);
      this.connectToSocket();
    })
  }


  // Attribute data source
  public telemetryData: any[] = []; // To store the telemetry data
  public seriesHidden: number[] = []; // To store the telemetry data
  private originalSeriesData: { [key: number]: any[] } = {};
  private destroy$ = new Subject<void>();
  @Input() deviceId: string;
  @Input() Attributes: string[];
  @Input() forecastId: string;

  entityId: EntityId;
  attributeScope: TelemetryType;
  dataSource: AttributeDatasource;
  displayData: boolean = true;

  setIntervalId: number;

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone
  ) {
    // Initialize the data source with necessary services
    // this.dataSource = new AttributeDatasource(
    //   this.attributeService,
    //   this.telemetryWsService,
    //   this.zone,
    //   this.translate
    // );

    // Initialize the chart data
    this.initChartData();
  }

  public chartInstance;

  ngAfterViewInit() {

  }

  async getHistoricalData() {
    // console.log("this")
    const startTs = Math.floor(Date.now() / 1000 - this.selected.seconds - 60);
    const history = (this.selected.seconds + 60);
    const interval = this.selected.interval;
    // const interval = 1000
    const agg = "AVG";
    const limit = 100;

    // console.log({
    //   startTs,
    //   history
    // })

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
    // console.log({ device_id })
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


  public forecast_chart_seconds_away = 60;

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
        next: () => {
          // console.log("connection opened");
        },
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
            // console.log(key, data.data[key], data.data[key].length);
            if (key === "datetime") return;
            // return;
            let values = data.data[key].map(([x, y]) => ({
              // x: new Date(x).getTime(),
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
            this.chartInstance.updateSeries(this.series);
          });
        }
      },
      error: (err) => { },
      complete: () => { },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Check if deviceId and Attributes have been set
    if (
      changes.deviceId &&
      this.deviceId &&
      changes.Attributes &&
      this.Attributes &&
      this.forecastId
    ) {
      // console.log("deviceId received: ", this.deviceId);
      // console.log("Attributes received: ", this.Attributes);
      // this.entityId = {
      //   entityType: EntityType.DEVICE,
      //   id: this.deviceId, // Use the passed deviceId
      // };
      // this.attributeScope = LatestTelemetry.LATEST_TELEMETRY;
      // console.log("series begin === ", this.series);
      // this.series = [];
      // this.telemetryData = [];
      // this.seriesHidden = [];
      // this.displayData = true;
      // this.originalSeriesData = {};
      // // Now that deviceId and Attributes are set, we can load attributes
      // this.loadAttributes();
      // console.log("forecast_id === ", this.forecastId);
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

  // Load telemetry (attributes) from the device
  loadAttributes() {
    this.dataSource
      .loadAttributes(this.entityId, this.attributeScope, new PageLink(100, 0)) // Fetch all data without pagination
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        // Store the loaded attributes and update the chart
        this.telemetryData = data.data;
        // console.log("attributes ==== ", this.attributes);
        this.updateXAxisFormatter();
        // this.condenseDataByMinute();
        this.processEntityData();
        this.addForecastModelData();
      });
  }

  processEntityData() {
    // TODO create as many colors as telemtry data
    const colors = ["#FF5733", "#33FF57"];
    const seriesArray = [];

    this.Attributes.forEach((attributeKey, index) => {
      const newChartData = this.telemetryData
        .filter((attribute) => attribute.key === attributeKey)
        .map((attribute) => ({
          x: new Date(attribute.lastUpdateTs).getTime(),
          y: parseFloat(attribute.value),
        }));

      // const existingSeriesIndex = this.series.findIndex((series) =>
      //   series.name.includes(attributeKey)
      // );
      const existingSeriesIndex = this.series.findIndex((series) =>
        series.name.includes(attributeKey)
      );
      if (existingSeriesIndex !== -1) {
        // Append new data to existing series while maintaining the zoom level
        if (this.seriesHidden.includes(existingSeriesIndex)) {
          console.log("series is hidden updating backup");
          this.originalSeriesData[existingSeriesIndex] = [
            ...(this.originalSeriesData[existingSeriesIndex] as {
              x: number;
              y: number;
            }[]),
            ...newChartData,
          ];
          return;
        }
        this.series[existingSeriesIndex].data = [
          ...(this.series[existingSeriesIndex].data as {
            x: number;
            y: number;
          }[]),
          ...newChartData,
        ];
      } else {
        // Create new series if it doesn’t exist
        seriesArray.push({
          name: `${attributeKey} Data`,
          data: newChartData,
          color: colors[index % colors.length],
        });
      }
    });
    // this.chart.updateSeries([...this.series, ...seriesArray]);
    if (this.displayData === true) {
      this.series = [...this.series, ...seriesArray];
      this.updateDashArray();
    }
    // console.log("series === ", this.series);
    // console.log("hidden === ", this.seriesHidden);
  }

  // Add a method to generate forecast model data
  addForecastModelData() {
    const forecastSeries = {
      name: "Forecast Model",
      data: this.generateRandomForecastData(),
      color: "#6A0DAD",
      dashArray: 10, // Makes the line dotted
    };

    const existingSeriesIndex = this.series.findIndex((series) =>
      series.name.includes("Forecast Model")
    );
    if (existingSeriesIndex !== -1) {
      return;
    }
    this.series.push(forecastSeries);
    this.updateDashArray();
    // this.chart.updateSeries(this.series); // Update the chart with the new series
  }

  // Generate random forecast data points
  generateRandomForecastData() {
    const forecastData = [];
    const currentTime = new Date().getTime();
    for (let i = 0; i < 60; i++) {
      forecastData.push({
        x: currentTime + i * 1000, // 1-minute intervals
        y: Math.random() * 100, // Random y values
      });
    }
    return forecastData;
  }

  condenseDataByMinute() {
    // Calculate min and max timestamps from your data
    const timestamps = this.series.flatMap((series) =>
      series.data.map((point) => point.x)
    );
    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    const diffInSeconds = (maxX - minX) / 1000;

    if (diffInSeconds > 60) {
      // If data covers more than 1 minute
      // Map over each series and condense data by minute
      this.series = this.series.map((series) => {
        const condensedData = this.groupDataByMinute(series.data);
        return { ...series, data: condensedData };
      });

      // Update x-axis labels to show condensed time
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
    } else {
      // Use default second-by-second formatter if data spans less than a minute
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
  }

  // Helper function to group data by minute
  groupDataByMinute(data) {
    const groupedData = [];
    let currentMinute = null;
    let minuteGroup = [];

    data.forEach((point) => {
      const pointMinute = new Date(point.x).getMinutes();
      if (pointMinute === currentMinute) {
        // Add data to the current minute group
        minuteGroup.push(point);
      } else {
        // Condense the current minute group (e.g., take average) and reset
        if (minuteGroup.length > 0) {
          groupedData.push(this.condenseMinuteGroup(minuteGroup));
        }
        currentMinute = pointMinute;
        minuteGroup = [point];
      }
    });

    // Condense the final minute group and add it
    if (minuteGroup.length > 0) {
      groupedData.push(this.condenseMinuteGroup(minuteGroup));
    }

    return groupedData;
  }

  // Condense minute data (here, calculating the average for illustration)
  condenseMinuteGroup(dataGroup) {
    const averageY =
      dataGroup.reduce((sum, point) => sum + point.y, 0) / dataGroup.length;
    return { x: dataGroup[0].x, y: averageY }; // Use the first timestamp in the group
  }

  updateXAxisFormatter() {
    // Calculate min and max timestamps from your data
    const timestamps = this.series.flatMap((series) =>
      series.data.map((point) => point.x)
    );
    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    const diff = maxX - minX;

    // Define your x-axis format based on the range difference
    if (diff > 365 * 24 * 60 * 60 * 1000) {
      // Over a year
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleDateString([], { year: "numeric" });
    } else if (diff > 30 * 24 * 60 * 60 * 1000) {
      // Over a month
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleDateString([], {
          month: "short",
          year: "numeric",
        });
    } else if (diff > 24 * 60 * 60 * 1000) {
      // Over a day
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleDateString([], {
          day: "2-digit",
          month: "short",
        });
    } else if (diff > 60 * 60 * 1000) {
      // Over an hour
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
    } else {
      // Less than an hour, show seconds
      this.xaxis.labels.formatter = (value, timestamp) =>
        new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
  }

  updateDashArray() {
    this.stroke = {
      ...this.stroke,
      dashArray: this.series.map((series) =>
        series.name.toLowerCase().includes("forecast") ? 8 : 0
      ),
    };
  }

  // Initialize chart configuration
  initChartData(): void {
    this.chart = {
      id: "realtime",
      type: "area",
      stacked: false,
      height: '100%',
      zoom: {
        type: "x",
        enabled: true,
        autoScaleYaxis: true,
        allowMouseWheelZoom: true,
      },
      toolbar: {
        show: false,
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
        // autoSelected: "zoom",
      },
      events: {
        beforeZoom: (chart, options) => {
          this.displayData = false;
        },

        beforeResetZoom: (chart, options) => {
          this.displayData = true;
          // console.log("home clicked");
        },
        legendClick: (chart, seriesIndex, options) => {
          if (this.seriesHidden.includes(seriesIndex)) {
            // Series was hidden, so remove from hidden list and restore original data
            this.seriesHidden = this.seriesHidden.filter(
              (i) => i !== seriesIndex
            );
            this.series[seriesIndex].data =
              this.originalSeriesData[seriesIndex]; // Restore original data
          } else {
            // Series is visible, so hide it and clear its data
            this.seriesHidden.push(seriesIndex);
            this.originalSeriesData[seriesIndex] = [
              ...this.series[seriesIndex].data,
            ]; // Backup original data
            this.series[seriesIndex].data = []; // Clear data to hide it
          }
        },
      },
      animations: {
        enabled: false, // Disables re-zooming upon new data points
      },
    };
    this.stroke = {
      // curve: "smooth",
      curve: "straight",
      // TODO generate the dashed array for only the forecast part
      width: 2,
    };
    this.dataLabels = {
      enabled: false,
    };

    this.markers = {
      size: 0,
    };
    this.legend = {
      show: true,
      showForSingleSeries: true,
      showForNullSeries: true,
      showForZeroSeries: true,
    };

    this.title = {
      text: "Forcast Over Time",
      align: "left",
    };

    this.fill = {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        inverseColors: false,
        opacityFrom: 0.5,
        opacityTo: 0,
        stops: [0, 90, 100],
      },
    };

    this.yaxis = {
      labels: {
        formatter: function (val) {
          if (val === undefined) return;
          return val.toFixed(2); // Adjust this to display temperature values
        },
      },
      title: {
        text: "Values",
      },
      min: 10,
      max: 160,
    };

    this.xaxis = {
      type: "datetime",
      labels: {
        datetimeFormatter: {
          year: "yyyy",
          month: "MMM 'yy",
          day: "dd MMM",
          hour: "HH:mm",
          minute: "HH:mm:ss", // For real-time updates at minute level
        },
        formatter: (value: string, timestamp: number) => {
          return new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }); // Format as hh:mm:ss
        },
      },
    };

    this.tooltip = {
      shared: false,
      y: {
        formatter: function (val) {
          if (val === undefined) return;
          return `${val.toFixed(2)} °C`;
        },
      },
    };
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    clearInterval(this.setIntervalId);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
