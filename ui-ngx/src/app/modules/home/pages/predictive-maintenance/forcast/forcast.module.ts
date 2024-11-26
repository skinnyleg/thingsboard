import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AppState } from "@app/core/core.state";
import { ForecastService } from "@app/core/http/forecast.service";
import { Order } from "@app/modules/home/models/predictive-maintenance.models";
import { PageComponent } from "@app/shared/public-api";
import { Store } from "@ngrx/store";

@Component({
  selector: "forcast",
  templateUrl: "./forcast.component.html",
  styleUrls: ["./forcast.component.scss"],
})
export class ForcastComponent extends PageComponent implements Order {
  deviceId: string; // To pass to the chart
  Attributes: string[]; // To store the temperature data
  forecastData: Order[];

  models: Order[];
  id: string;
  trueId: string;
  device: string;
  date: string;
  status: string;

  constructor(
    protected store: Store<AppState>,
    protected route: ActivatedRoute,
    private forecastService: ForecastService,
    protected router: Router
  ) {
    super(store);
  }

  changeModel(value: any) {
    this.router.navigateByUrl("/PM/forcast/" + value);

    this.deviceId = "";
    this.Attributes = [];
    this.trueId = value;
    this.fetchForcast(value);
  }
  ngOnInit(): void {
    // Check if data was passed via the router's state
    if (history.state && history.state.forecastData) {
      this.forecastData = history.state.forecastData;
      // console.log("Forecast data received:", this.forecastData);
    } else {
      // Optionally, handle the case when data is not passed
      console.error("No forecast data passed.");
    }
    this.init();
  }

  private init() {
    this.route.params.subscribe((params) => {
      if (params.id) {
        this.id = params.id;
        this.fetchForcast(params.id);
        this.models = this.forecastData;
        // console.log("models === ", this.models);
        if (this.models === undefined || this.models.length === 0) {
          return this.router.navigateByUrl("/PM");
        }
        const forecast = this.models.find(
          (element) => element.trueId === this.id
        );
        if (!forecast) return this.router.navigateByUrl("");
        this.device = forecast.device;
        this.date = forecast.date;
        this.status = forecast.status;
      }
    });
  }

  fetchForcast(forcastId: string): any {
    this.forecastService.getForecast(forcastId).subscribe(
      (data) => {
        this.deviceId = data.deviceId.id;
        this.Attributes = data.attributes.map((attr) => {
          return attr.key;
        });
        this.trueId = data.id.id;
      },
      (error) => {
        console.error("Error fetching forecast:", error);
      }
    );
  }
}
