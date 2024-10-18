///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

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
    this.router.navigateByUrl("/PM/anomaly-detection/" + value);
  }

  models: Order[];

  id: string;
  trueId: string;

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
    // this.models = ELEMENT_DATA;
    // const anomaly = this.models.find((element) => element.id === this.id);
    // if (!anomaly) return this.router.navigateByUrl("");
    // this.device = anomaly.device;
    // // this.user = anomaly.user;
    // this.date = anomaly.date;
    // this.status = anomaly.status;
  }
}
