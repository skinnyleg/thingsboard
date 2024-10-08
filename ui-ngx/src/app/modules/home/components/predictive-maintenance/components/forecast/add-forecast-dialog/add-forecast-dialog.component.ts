import { Component, OnInit } from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { DeviceService } from "@app/core/public-api";
import { DevicesDataSource } from "@app/modules/home/models/datasource/device-datasource";
import { DeviceInfo } from "@shared/models/device.models";
import { PageLink } from "@shared/models/page/page-link";
import { Observable } from "rxjs";
import { map, startWith } from "rxjs/operators";

// Import necessary Angular Material modules
import { CommonModule } from "@angular/common";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatNativeDateModule } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Direction } from "@app/shared/public-api";

@Component({
  selector: "app-add-forecast-dialog",
  templateUrl: "./add-forecast-dialog.component.html",
  styleUrls: ["./add-forecast-dialog.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule,
    ReactiveFormsModule, // For reactive form
    MatAutocompleteModule, // For autocomplete
  ],
})
export class AddForecastDialogComponent implements OnInit {
  devicesDataSource: DevicesDataSource;
  selectedDevice: DeviceInfo | null = null;
  fields: string[] = [];
  myControl = new FormControl<string | DeviceInfo>(""); // Control for autocomplete
  filteredDevices: Observable<DeviceInfo[]>; // For filtered options in autocomplete

  devicesList: DeviceInfo[] = []; // To store the fetched devices

  constructor(
    public dialogRef: MatDialogRef<AddForecastDialogComponent>,
    private deviceService: DeviceService
  ) {
    this.devicesDataSource = new DevicesDataSource(this.deviceService);
  }

  ngOnInit(): void {
    const pageLink = new PageLink(10, 0, null, {
      property: "createdTime",
      direction: Direction.DESC,
    });

    // Subscribe to the devices$ observable to populate devicesList
    this.devicesDataSource.loadDevices(pageLink);
    this.devicesDataSource.devices$.subscribe((devices) => {
      this.devicesList = devices;
      // Find the device with the name "Thermostat T2"
      const thermostatT2 = devices.find(
        (device) => device.name === "Thermostat T2"
      );

      if (thermostatT2) {
        console.log("Device ID for Thermostat T2:", thermostatT2.id);

        // Now, you can call the getDevice() method to fetch device details
        this.deviceService.getDevice(thermostatT2.id.id).subscribe(
          (deviceDetails) => {
            console.log("Device Details for Thermostat T2:", deviceDetails);
          },
          (error) => {
            console.error("Error fetching device details:", error);
          }
        );
      } else {
        console.log("Thermostat T2 not found.");
      }
    });

    // Set up filtered devices observable based on user input
    this.filteredDevices = this.myControl.valueChanges.pipe(
      startWith(""),
      map((value) => (typeof value === "string" ? value : value?.name)),
      map((name) =>
        name ? this._filterDevices(name) : this.devicesList.slice()
      )
    );
  }

  // Function to filter devices based on user input
  private _filterDevices(name: string): DeviceInfo[] {
    const filterValue = name.toLowerCase();
    return this.devicesList.filter((option) =>
      option.name.toLowerCase().includes(filterValue)
    );
  }

  // Display function for showing device name
  displayFn(device: DeviceInfo): string {
    return device && device.name ? device.name : "";
  }

  addField(): void {
    this.fields.push("");
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    this.dialogRef.close({
      name: "Forecast",
      device: this.selectedDevice,
      fields: this.fields,
    });
  }
}
