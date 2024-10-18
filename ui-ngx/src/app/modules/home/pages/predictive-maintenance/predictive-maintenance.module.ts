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

import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "@shared/shared.module";
import { PredictiveMaintenanceRoutingModule } from "./predictive-maintenance-routing.module";
import { AnomalyDetectionComponent } from "./anomaly-detection/anomaly-detection-page.module";
import { NgApexchartsModule } from "ng-apexcharts";
import { ForcastChartComponent } from "../../components/predictive-maintenance/components/forcast-chart/forcast-chart.component";
import { ForcastComponent } from "./forcast/forcast.module";

@NgModule({
  declarations: [AnomalyDetectionComponent, ForcastComponent],
  imports: [
    CommonModule,
    SharedModule,
    PredictiveMaintenanceRoutingModule,
    NgApexchartsModule,
    ForcastChartComponent,
  ],
})
export class PredictiveMaintenanceModule {}
