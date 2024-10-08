import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AppState } from "@app/core/core.state";
import { PageComponent } from "@app/shared/public-api";
import { Store } from "@ngrx/store";
import {
  Order,
  ELEMENT_DATA,
} from "@home/components/predictive-maintenance/components/anomaly-detection/anomaly-detection.component";

@Component({
  selector: "anomaly-detection",
  template: `
    <div>
        <label class="model-select-label">Anomaly tasks</label>
        <select (change)="changeModel($event.target.value)" class="model-select">
        <option
            *ngFor="let model of models"
            [value]="model.id"
            [selected]="model.id === '#' + id"
        >
            {{ model.id }} - {{ model.device }} - {{ model.user }} -
            {{ model.date }} - {{ model.status }}
        </option>
        </select>
        <div class="anomaly-detection-container">
            <div class="anomaly-detection-content">
                <div class="anomaly-detection-header">
                    <div class="anomaly-detection-tabs">
                        <p>Anomaly Summary</p>
                        <p>Anomaly Details</p>
                        <p>Cluster Infos</p>
                    </div>
                    <div class="anomaly-detection-action">
                        <button mat-raised-button color="primary">ReBuild</button>
                        <button mat-raised-button color="primary">Apply To</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  `,
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
