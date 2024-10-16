import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AppState } from "@app/core/core.state";
import {
  ELEMENT_DATA,
  Order,
} from "@app/modules/home/models/predictive-maintenance.models";
import { PageComponent } from "@app/shared/public-api";
import { Store } from "@ngrx/store";

@Component({
  selector: "anomaly-detection",
  templateUrl: "./anomaly-detection.component.html",
  styleUrls: ["./anomaly-detection.component.scss"],
})
export class AnomalyDetectionComponent extends PageComponent implements Order {
  constructor(
    protected store: Store<AppState>,
    protected route: ActivatedRoute,
    protected router: Router
  ) {
    super(store);
    this.init();
  }

  changeModel(value: any) {
    this.router.navigateByUrl("/PM/anomaly-detection/" + value.slice(1));
  }

  models: Order[];

  id: string;

  device: string;

  user: string;

  date: string;

  status: string;

  private init() {
    this.route.params.subscribe((params) => {
      if (params.id) {
        this.id = params.id;
      }
    });
    this.models = ELEMENT_DATA;
    const anomaly = this.models.find((element) => element.id === "#" + this.id);
    if (!anomaly) return this.router.navigateByUrl("");
    this.device = anomaly.device;
    this.user = anomaly.user;
    this.date = anomaly.date;
    this.status = anomaly.status;
  }
}
