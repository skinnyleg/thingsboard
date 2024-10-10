import { Component, OnInit } from "@angular/core";
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { AttributeService, DeviceService } from "@app/core/public-api";
import { DevicesDataSource } from "@app/modules/home/models/datasource/device-datasource";
import { DeviceInfo } from "@shared/models/device.models";
import { PageLink } from "@shared/models/page/page-link";
import { Observable, of } from "rxjs";
import { map, startWith } from "rxjs/operators";
import { MatDateRangePicker } from "@angular/material/datepicker";

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
import { Direction, EntityType } from "@app/shared/public-api";

interface ForecastField {
  type: string;
  start: string;
  end: string;
}

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
  fields: ForecastField[] = []; // Array for field type, start, and end dates
  availableTelemetry: string[] = []; // Available telemetry keys as an observable
  myControl = new FormControl<string | DeviceInfo>("", Validators.required); // Control for autocomplete
  forecastNameControl = new FormControl("", Validators.required);
  filteredDevices: Observable<DeviceInfo[]>; // For filtered options in autocomplete
  devicesList: DeviceInfo[] = []; // To store the fetched devices
  noTelemetryMessage: string | null = null; // Message to show if no telemetry is available

  constructor(
    public dialogRef: MatDialogRef<AddForecastDialogComponent>,
    private deviceService: DeviceService,
    private attributeService: AttributeService
  ) {
    this.devicesDataSource = new DevicesDataSource(this.deviceService);
  }

  ngOnInit(): void {
    const pageLink = new PageLink(11, 0, null, {
      property: "createdTime",
      direction: Direction.DESC,
    });

    // Subscribe to the devices$ observable to populate devicesList
    this.devicesDataSource.loadDevices(pageLink);
    this.devicesDataSource.devices$.subscribe((devices) => {
      this.devicesList = devices;
    });

    // Set up filtered devices observable based on user input
    this.filteredDevices = this.myControl.valueChanges.pipe(
      startWith(""),
      map((value) => (typeof value === "string" ? value : value?.name)),
      map((name) =>
        name ? this._filterDevices(name) : this.devicesList.slice()
      )
    );

    // Clear fields when device changes
    this.myControl.valueChanges.subscribe((device) => {
      this.fields = []; // Clear fields when a new device is selected
      this.selectedDevice = typeof device === "object" ? device : null;
      this.noTelemetryMessage = null; // Reset the message
      if (this.selectedDevice) {
        this.onDeviceSelected(this.selectedDevice);
      }
    });
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

  // When the user selects a device, fetch the telemetry for that device
  onDeviceSelected(selectedDevice: DeviceInfo): void {
    this.selectedDevice = selectedDevice;

    this.attributeService
      .getEntityTimeseriesLatest({
        entityType: EntityType.DEVICE,
        id: selectedDevice.id.id,
      })
      .subscribe(
        (telemetryData) => {
          const telemetryKeys = Object.keys(telemetryData);
          console.log(
            "Available telemetry for the selected device:",
            telemetryKeys
          );

          // Set available telemetry keys
          this.availableTelemetry = telemetryKeys;

          // If no telemetry available, notify the user
          if (telemetryKeys.length === 0) {
            this.noTelemetryMessage =
              "No telemetry options available for this device. Please choose another device.";
          } else {
            this.noTelemetryMessage = null; // Reset if telemetry is available
          }
        },
        (error) => {
          console.error("Error fetching telemetry data:", error);
        }
      );
  }
  //  && this.selectedDevice != null
  get canAddField(): boolean {
    if (this.availableTelemetry.length === 0) {
      return true; // Disable adding fields if no telemetry is available
    }
    return this.fields.length < this.availableTelemetry.length;
  }

  get isFormValid(): boolean {
    return (
      this.forecastNameControl.valid &&
      this.selectedDevice != null && // Ensure a device is selected
      this.fields.length > 0 && // Ensure at least one field is added
      this.fields.every((field) => field.type && field.start && field.end)
    );
  }

  // Add a new field with telemetry autocomplete
  addField(): void {
    if (this.canAddField) {
      this.fields.push({ type: "", start: "", end: "" });
    }
  }

  // Get telemetry options excluding already selected ones
  getFilteredTelemetry(index: number): string[] {
    return this.availableTelemetry.filter(
      (telemetry) =>
        !this.fields.some((field, i) => field.type === telemetry && i !== index)
    );
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.isFormValid) {
      console.log("Form is invalid. Please complete all required fields.");
      return;
    }
    this.dialogRef.close({
      name: this.forecastNameControl.value,
      device: this.selectedDevice,
      fields: this.fields,
    });
  }
}
