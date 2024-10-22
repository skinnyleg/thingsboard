import { Component, NgZone, OnInit, OnDestroy } from "@angular/core";
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexTitleSubtitle,
  ApexDataLabels,
  ApexFill,
  ApexMarkers,
  ApexYAxis,
  ApexXAxis,
  ApexTooltip,
  NgApexchartsModule,
} from "ng-apexcharts";
import { AttributeDatasource } from "@home/models/datasource/attribute-datasource";
import { AttributeService } from "@core/http/attribute.service";
import { TelemetryWebsocketService } from "@core/ws/telemetry-websocket.service";
import { TranslateService } from "@ngx-translate/core";
import { EntityId } from "@shared/models/id/entity-id";
import { PageLink } from "@shared/models/page/page-link";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import {
  TelemetryType,
  LatestTelemetry,
} from "@shared/models/telemetry/telemetry.models";
import { EntityType } from "@app/shared/public-api";
import { CommonModule } from "@angular/common";
import { chartSeries } from "@app/modules/home/models/predictive-maintenance.models";

@Component({
  selector: "tb-forcast-chart",
  templateUrl: "./forcast-chart.component.html",
  styleUrls: ["./forcast-chart.component.scss"],
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
})
export class ForcastChartComponent implements OnInit, OnDestroy {
  // ApexChart configuration

  public series: ApexAxisChartSeries = [];
  public chart: ApexChart;
  public dataLabels: ApexDataLabels;
  public markers: ApexMarkers;
  public title: ApexTitleSubtitle;
  public fill: ApexFill;
  public yaxis: ApexYAxis;
  public xaxis: ApexXAxis;
  public tooltip: ApexTooltip;

  // Attribute data source
  public attributes: any[] = []; // To store the telemetry data
  private destroy$ = new Subject<void>();

  // Device and telemetry configurations
  entityId: EntityId = {
    entityType: EntityType.DEVICE,
    id: "40478490-8588-11ef-a140-1f0970035087", // Replace with your actual device ID
  };
  attributeScope: TelemetryType = LatestTelemetry.LATEST_TELEMETRY;

  dataSource: AttributeDatasource;

  constructor(
    private attributeService: AttributeService,
    private telemetryWsService: TelemetryWebsocketService,
    private translate: TranslateService,
    private zone: NgZone
  ) {
    // Initialize the data source with necessary services
    this.dataSource = new AttributeDatasource(
      this.attributeService,
      this.telemetryWsService,
      this.zone,
      this.translate
    );

    // Initialize the chart data
    this.initChartData();
  }

  ngOnInit(): void {
    // Load attributes (telemetry) on component initialization
    this.loadAttributes();
  }

  // Load telemetry (attributes) from the device
  loadAttributes() {
    this.dataSource
      .loadAttributes(this.entityId, this.attributeScope, new PageLink(100, 0)) // Fetch all data without pagination
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        // Store the loaded attributes and update the chart
        this.attributes = data.data;
        // console.log("attributes ==== ", this.attributes);
        this.processEntityData();
      });
  }

  processEntityData() {
    // Assuming the data contains temperature readings in 'attributes'
    console.log("series === ", this.series[0]);
    const newChartData = this.attributes
      .filter((attribute) => attribute.key === "temperature") // Only take temperature data
      .map((attribute) => {
        const timestamp = attribute.lastUpdateTs; // Timestamp from telemetry data
        const value = parseFloat(attribute.value); // Assuming 'value' holds the telemetry (temperature)
        return { x: new Date(timestamp).getTime(), y: value }; // Ensure it's in {x, y} format
      });

    // Check if the series exists and append the new data to it
    if (
      this.series &&
      this.series.length > 0 &&
      Array.isArray(this.series[0].data)
    ) {
      // Append the new data to the existing chart data
      const newSeries = [
        ...(this.series[0].data as { x: Date; y: number }[]), // Ensure the existing data is in the correct format
        ...newChartData,
      ];

      this.series = [
        {
          name: "Temperature Data",
          data: newSeries,
        },
      ];
    } else {
      // Initialize series if it doesn't exist
      this.series = [
        {
          name: "Temperature Data",
          data: newChartData,
        },
      ];
    }
  }

  // Initialize chart configuration
  initChartData(): void {
    this.chart = {
      type: "area",
      stacked: false,
      height: 350,
      zoom: {
        type: "x",
        enabled: true,
        autoScaleYaxis: true,
      },
      toolbar: {
        autoSelected: "zoom",
      },
    };

    this.dataLabels = {
      enabled: false,
    };

    this.markers = {
      size: 0,
    };

    this.title = {
      text: "Temperature Over Time",
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
          return val.toFixed(2); // Adjust this to display temperature values
        },
      },
      title: {
        text: "Temperature (°C)",
      },
    };

    this.xaxis = {
      type: "datetime",
    };

    this.tooltip = {
      shared: false,
      y: {
        formatter: function (val) {
          return `${val.toFixed(2)} °C`;
        },
      },
    };
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
