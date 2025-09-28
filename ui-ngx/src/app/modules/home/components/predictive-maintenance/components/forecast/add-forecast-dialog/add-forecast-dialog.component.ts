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

import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
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
import { Observable, of, Subject } from "rxjs";
import { map, startWith, takeUntil } from "rxjs/operators";

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
import { ForecastField } from "@app/modules/home/models/predictive-maintenance.models";

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
export class AddForecastDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  devicesDataSource: DevicesDataSource;
  selectedDevice: DeviceInfo | null = null;
  fields: ForecastField[] = []; // Array for field type, start, and end dates
  availableTelemetry: string[] = []; // Available telemetry keys as an observable
  myControl = new FormControl<string | DeviceInfo>("", Validators.required); // Control for autocomplete
  forecastNameControl = new FormControl("", Validators.required);
  filteredDevices: Observable<DeviceInfo[]>; // For filtered options in autocomplete
  devicesList: DeviceInfo[] = []; // To store the fetched devices
  noTelemetryMessage: string | null = null; // Message to show if no telemetry is available

  // Step navigation properties
  currentStep: number = 1;
  totalSteps: number = 2;

  // Global date range properties (renamed for forecast)
  globalStartDate: Date | null = null;
  globalEndDate: Date | null = null;

  // Anomalies date range properties
  anomaliesStartDate: Date | null = null;
  anomaliesEndDate: Date | null = null;

  // Algorithm form controls
  forecastAlgorithmControl = new FormControl("", Validators.required);
  anomaliesAlgorithmControl = new FormControl("", Validators.required);

  // Algorithm options
  forecastAlgorithmOptions = [
    {
      value: "arima",
      label: "ARIMA (Auto Regressive Integrated Moving Average)",
    },
    { value: "lstm", label: "LSTM (Long Short-Term Memory)" },
    { value: "linear_regression", label: "Linear Regression" },
    { value: "polynomial_regression", label: "Polynomial Regression" },
    { value: "exponential_smoothing", label: "Exponential Smoothing" },
    { value: "prophet", label: "Prophet" },
    { value: "sarima", label: "SARIMA (Seasonal ARIMA)" },
    { value: "random_forest", label: "Random Forest" },
  ];

  anomaliesAlgorithmOptions = [
    { value: "isolation_forest", label: "Isolation Forest" },
    { value: "one_class_svm", label: "One-Class SVM" },
    { value: "local_outlier_factor", label: "Local Outlier Factor (LOF)" },
    { value: "elliptic_envelope", label: "Elliptic Envelope" },
    { value: "statistical_outlier", label: "Statistical Outlier Detection" },
    { value: "dbscan", label: "DBSCAN Clustering" },
    { value: "autoencoder", label: "Autoencoder Neural Network" },
    { value: "seasonal_decompose", label: "Seasonal Decomposition" },
  ];

  constructor(
    public dialogRef: MatDialogRef<AddForecastDialogComponent>,
    private deviceService: DeviceService,
    private attributeService: AttributeService
  ) {
    this.devicesDataSource = new DevicesDataSource(this.deviceService);
  }

  ngOnInit(): void {
    // Initialize forecast dates with default values (last 30 days)
    this.globalEndDate = new Date();
    this.globalStartDate = new Date();
    this.globalStartDate.setDate(this.globalStartDate.getDate() - 30);

    // Initialize anomalies dates with default values (last 60 days)
    this.anomaliesEndDate = new Date();
    this.anomaliesStartDate = new Date();
    this.anomaliesStartDate.setDate(this.anomaliesStartDate.getDate() - 60);

    // Load the first page with only one device to get the total count
    const firstPageLink = new PageLink(1, 0, null, {
      property: "createdTime",
      direction: Direction.DESC,
    });

    // Load the first page of devices
    this.devicesDataSource.fetchTotalElements(firstPageLink);

    // Subscribe to the total number of devices once the first request completes
    this.devicesDataSource.totalElements$.subscribe((totalElements) => {
      console.log("Total number of devices:", totalElements);

      // Once we know the total number of devices, fetch all of them
      const fullPageLink = new PageLink(totalElements, 0, null, {
        property: "createdTime",
        direction: Direction.DESC,
      });

      // Fetch the full list of devices
      this.devicesDataSource.loadDevices(fullPageLink);
    });

    // Subscribe to the devices$ observable to populate devicesList
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

          // If no telemetry available, offer to add custom attributes
          if (telemetryKeys.length === 0) {
            this.noTelemetryMessage =
              "No telemetry attributes found for this device. You can add custom attributes below or proceed without them.";
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
    if (!this.selectedDevice) {
      return false; // Cannot add fields without a selected device
    }

    // Always allow adding fields when device is selected
    // If telemetry exists, limit to available telemetry count
    // If no telemetry, allow unlimited custom attributes (reasonable limit)
    const maxFields =
      this.availableTelemetry.length > 0 ? this.availableTelemetry.length : 10;
    return this.fields.length < maxFields;
  }

  get isFormValid(): boolean {
    const isForecastDateRangeValid =
      this.globalStartDate != null &&
      this.globalEndDate != null &&
      this.globalStartDate < this.globalEndDate;

    const isAnomaliesDateRangeValid =
      this.anomaliesStartDate != null &&
      this.anomaliesEndDate != null &&
      this.anomaliesStartDate < this.anomaliesEndDate;

    // Validate telemetry attributes only if they exist
    const areAttributesValid =
      this.fields.length === 0 ||
      this.fields.every((field) => field.key && field.key.trim() !== "");

    return (
      this.forecastNameControl.valid &&
      this.selectedDevice != null && // Ensure a device is selected
      isForecastDateRangeValid && // Ensure valid forecast date range
      isAnomaliesDateRangeValid && // Ensure valid anomalies date range
      this.forecastAlgorithmControl.valid && // Ensure forecast algorithm is selected
      this.anomaliesAlgorithmControl.valid && // Ensure anomalies algorithm is selected
      areAttributesValid // Validate attributes only if they exist
    );
  }

  // Step-specific validation
  isCurrentStepValid(): boolean {
    switch (this.currentStep) {
      case 1:
        // Validate telemetry attributes only if they exist
        const areAttributesValid =
          this.fields.length === 0 ||
          this.fields.every((field) => field.key && field.key.trim() !== "");

        return (
          this.forecastNameControl.valid &&
          this.selectedDevice != null &&
          areAttributesValid // Attributes are optional but must be valid if present
        );
      case 2:
        const isForecastDateRangeValid =
          this.globalStartDate != null &&
          this.globalEndDate != null &&
          this.globalStartDate < this.globalEndDate;

        const isAnomaliesDateRangeValid =
          this.anomaliesStartDate != null &&
          this.anomaliesEndDate != null &&
          this.anomaliesStartDate < this.anomaliesEndDate;

        return (
          isForecastDateRangeValid &&
          isAnomaliesDateRangeValid &&
          this.forecastAlgorithmControl.valid &&
          this.anomaliesAlgorithmControl.valid
        );
      default:
        return false;
    }
  }

  // Step navigation methods
  nextStep(): void {
    if (this.currentStep < this.totalSteps && this.isCurrentStepValid()) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Add a new field with telemetry autocomplete
  addField(): void {
    if (this.canAddField) {
      this.fields.push({ key: "", startDate: null, endDate: null });
    }
  }

  // Get telemetry options excluding already selected ones
  getFilteredTelemetry(index: number): string[] {
    // If telemetry is available, filter it
    if (this.availableTelemetry.length > 0) {
      return this.availableTelemetry.filter(
        (telemetry) =>
          !this.fields.some(
            (field, i) => field.key === telemetry && i !== index
          )
      );
    }

    // If no telemetry available, return empty array (allows manual input)
    return [];
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
    const deviceId = this.selectedDevice.id;

    // Only include attribute keys without startDate and endDate
    const attributes = this.fields
      .filter((field) => field.key && field.key.trim() !== "")
      .map((el) => ({ key: el.key }));

    this.dialogRef.close({
      name: this.forecastNameControl.value,
      deviceId: deviceId,
      attributes: attributes, // This can now be an empty array
      forecastAlgorithm: this.forecastAlgorithmControl.value,
      anomaliesAlgorithm: this.anomaliesAlgorithmControl.value,
      forecastStartDate: this.globalStartDate.getTime(),
      forecastEndDate: this.globalEndDate.getTime(),
      anomaliesStartDate: this.anomaliesStartDate.getTime(),
      anomaliesEndDate: this.anomaliesEndDate.getTime(),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFieldAutocomplete(index: number): any {
    return this.availableTelemetry.length > 0 ? "telemetryAuto" : null;
  }
}
