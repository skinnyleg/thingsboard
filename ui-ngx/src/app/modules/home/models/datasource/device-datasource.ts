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

import { PageLink } from "@shared/models/page/page-link";
import { ReplaySubject } from "rxjs";
import { DeviceService } from "@app/core/public-api";
import { catchError, tap } from "rxjs/operators";
import { DeviceInfo, DeviceInfoQuery } from "@shared/models/device.models";

export class DevicesDataSource {
  private devicesSubject = new ReplaySubject<DeviceInfo[]>(1); // Stores the devices
  devices$ = this.devicesSubject.asObservable(); // Exposes devices$ observable

  constructor(private deviceService: DeviceService) {}

  loadDevices(pageLink: PageLink): void {
    const deviceInfoQuery = new DeviceInfoQuery(pageLink, {}); // You can customize the filter object here
    this.deviceService
      .getDeviceInfosByQuery(deviceInfoQuery)
      .pipe(
        tap((pageData) => {
          console.log("Fetched devices:", pageData); // Log the fetched data for debugging
          this.devicesSubject.next(pageData.data); // Push devices data into the subject
        }),
        catchError((error) => {
          console.error("Error fetching devices:", error); // Log errors
          this.devicesSubject.next([]); // Push empty array in case of error
          return [];
        })
      )
      .subscribe();
  }
}
