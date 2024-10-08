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
          console.log("Fetched devices:", pageData.data); // Log the fetched data for debugging
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
