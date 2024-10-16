import { ForecastService } from "./../../../../core/http/forecast.service";
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

import { Injectable, NgModule } from "@angular/core";
import { Resolve, RouterModule, Routes } from "@angular/router";
import { PredictiveMaintenanceComponent } from "@app/modules/home/components/predictive-maintenance/predictive-maintenance.component";
import { OAuth2Service } from "@core/http/oauth2.service";
import { Authority } from "@shared/models/authority.enum";
import { Observable } from "rxjs";
import { AnomalyDetectionComponent } from "@app/modules/home/pages/predictive-maintenance/anomaly-detection/anomaly-detection-page.module";
import { RouterTabsComponent } from "../../components/router-tabs.component";
import { ForcastComponent } from "./forcast/forcast.module";

@Injectable()
export class OAuth2LoginProcessingUrlResolver implements Resolve<string> {
  constructor(private oauth2Service: OAuth2Service) {}

  resolve(): Observable<string> {
    return this.oauth2Service.getLoginProcessingUrl();
  }
}

const routes: Routes = [
  {
    path: "PM",
    data: {
      breadcrumb: {
        label: "Predictive Maintenance",
        icon: "mdi:line-up",
      },
      // alarmsMode: AlarmsMode.ALL
    },
    children: [
      {
        path: "",
        component: PredictiveMaintenanceComponent,
        data: {
          auth: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
          title: "predictive-maintenance.predictive-maintenance",
          isPage: true,
        },
      },
      {
        path: "anomaly-detection/:id",
        component: AnomalyDetectionComponent,
        data: {
          auth: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
          title: "predictive-maintenance.anomaly-detection",
          breadcrumb: {
            label: "Anomaly Detection",
            icon: "mdi:alert",
          },
          isPage: true,
        },
      },
      {
        path: "forcast/:id",
        component: ForcastComponent,
        data: {
          auth: [Authority.TENANT_ADMIN, Authority.CUSTOMER_USER],
          title: "predictive-maintenance.forcast",
          breadcrumb: {
            label: "Forcast",
            icon: "mdi:alert",
          },
          isPage: true,
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [],
})
export class PredictiveMaintenanceRoutingModule {}
