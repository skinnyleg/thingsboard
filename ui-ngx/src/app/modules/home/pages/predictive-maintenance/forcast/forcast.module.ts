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
  }
  ngOnInit(): void {
    this.init();
  }

  models: Order[];

  id: string;

  trueId: string;

  device: string;

  date: string;

  status: string;

  private init() {
    this.route.params.subscribe((params) => {
      if (params.id) {
        this.id = params.id;
        this.fetchForcast(params.id);
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
      },
      (error) => {
        console.error("Error fetching forecast:", error);
      }
    );
  }
}
