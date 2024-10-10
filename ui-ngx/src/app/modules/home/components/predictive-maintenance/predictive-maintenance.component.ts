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

import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Store } from '@ngrx/store';
import { skip, startWith, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { FormBuilder } from '@angular/forms';
import { MatSidenav } from '@angular/material/sidenav';
import { AuthState } from '@core/auth/auth.models';
import { getCurrentAuthState, getCurrentAuthUser } from '@core/auth/auth.selectors';
import { AppState } from '@core/core.state';
import { ActiveComponentService } from '@core/services/active-component.service';
import { WINDOW } from '@core/services/window.service';
import { ISearchableComponent } from '@home/models/searchable-component.models';
import { PageComponent } from '@shared/components/page.component';
import { MediaBreakpoints } from '@shared/models/constants';
import screenfull from 'screenfull';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { ForcastComponent } from './components/forecast/forcast-page.component';
import { AnomalyDetectionComponent } from './components/anomaly-detection/anomaly-detection.component';

@Component({
  selector: 'tb-predictive-maintenance',
  templateUrl: './predictive-maintenance.component.html',
  styleUrls: ['./predictive-maintenance.component.scss'],
  standalone: true,
  imports: [CommonModule, MatTabsModule, ForcastComponent, AnomalyDetectionComponent]
})
export class PredictiveMaintenanceComponent extends PageComponent implements OnInit {

  constructor(protected store: Store<AppState>) {
    super(store);
  }

  ngOnInit() {

  }

}
