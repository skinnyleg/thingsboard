import {
  Component,
  NgZone,
  OnInit,
  OnDestroy,
  Input,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
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
export class ForcastChartComponent implements OnInit, OnChanges, OnDestroy {
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
  public telemetryData: any[] = []; // To store the telemetry data
  private destroy$ = new Subject<void>();
  @Input() deviceId: string;
  @Input() Attributes: string[];
  // Device and telemetry configurations
  entityId: EntityId;
  attributeScope: TelemetryType;
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

  ngOnChanges(changes: SimpleChanges): void {
    // Check if deviceId and Attributes have been set
    if (
      changes.deviceId &&
      this.deviceId &&
      changes.Attributes &&
      this.Attributes
    ) {
      console.log("deviceId received: ", this.deviceId);
      console.log("Attributes received: ", this.Attributes);

      this.entityId = {
        entityType: EntityType.DEVICE,
        id: this.deviceId, // Use the passed deviceId
      };
      this.attributeScope = LatestTelemetry.LATEST_TELEMETRY;

      // Now that deviceId and Attributes are set, we can load attributes
      this.loadAttributes();
    }
  }
  ngOnInit(): void {}

  // ngOnInit(): void {
  //   // Load attributes (telemetry) on component initialization
  //   this.entityId = {
  //     entityType: EntityType.DEVICE,
  //     id: this.deviceId, // Replace with your actual device ID
  //   };
  //   this.attributeScope = LatestTelemetry.LATEST_TELEMETRY;
  //   console.log("entity === ", this.entityId);
  //   console.log("attributeScope === ", this.attributeScope);
  //   this.loadAttributes();
  // }

  // Load telemetry (attributes) from the device
  loadAttributes() {
    this.dataSource
      .loadAttributes(this.entityId, this.attributeScope, new PageLink(100, 0)) // Fetch all data without pagination
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        // Store the loaded attributes and update the chart
        this.telemetryData = data.data;
        // console.log("attributes ==== ", this.attributes);
        this.processEntityData();
      });
  }

  processEntityData() {
    // Array of attribute keys that you want to track (e.g., "temperature", "humidity")
    const colors = ["#FF5733", "#33FF57"]; // Add more colors as needed or generate them dynamically

    // Initialize an empty array for the series
    const seriesArray = [];

    // Loop through each attribute you want to track (e.g., temperature, humidity)
    this.Attributes.forEach((attributeKey, index) => {
      const newChartData = this.telemetryData
        .filter((attribute) => attribute.key === attributeKey) // Filter the data based on the attribute key
        .map((attribute) => {
          const timestamp = attribute.lastUpdateTs; // Timestamp from telemetry data
          const value = parseFloat(attribute.value); // Assuming 'value' holds the telemetry data
          return { x: new Date(timestamp).getTime(), y: value }; // Ensure it's in {x, y} format
        });

      // Check if the series exists and append the new data to it
      const existingSeriesIndex = this.series.findIndex((series) =>
        series.name.includes(attributeKey)
      );

      if (existingSeriesIndex !== -1) {
        // Append new data to the existing series
        const existingData = this.series[existingSeriesIndex].data as {
          x: Date;
          y: number;
        }[];
        const updatedSeriesData = [...existingData, ...newChartData];

        this.series[existingSeriesIndex] = {
          ...this.series[existingSeriesIndex],
          data: updatedSeriesData,
        };
      } else {
        // Create a new series if it doesn't exist
        const newSeries = {
          name: `${attributeKey} Data`, // Capitalize the attribute name for the chart
          data: newChartData,
          color: colors[index % colors.length], // Assign color based on the index (loops if more attributes than colors)
        };

        // Add the new series to the series array
        seriesArray.push(newSeries);
      }
    });

    // If new series were created, merge them into the existing series
    this.series = [...this.series, ...seriesArray];
    console.log("series === ", this.series);
  }

  // Initialize chart configuration
  initChartData(): void {
    this.chart = {
      type: "area",
      stacked: false,
      height: 350,
      // zoom: {
      //   type: "x",
      //   enabled: true,
      //   autoScaleYaxis: true,
      // },
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
          return val.toFixed(2); // Adjust this to display temperature values
        },
      },
      title: {
        text: "Values",
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
