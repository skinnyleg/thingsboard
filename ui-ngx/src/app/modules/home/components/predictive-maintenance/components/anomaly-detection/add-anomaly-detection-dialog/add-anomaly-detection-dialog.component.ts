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

import { Component, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { HttpClient } from "@angular/common/http";
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common'; // Needed for common directives
import { FormsModule } from '@angular/forms';

type Device = {
  name: string;
  id: {
    id: string;
  }
}

    type DevicesRes = {
      data: Device[];
    }

@Component({
  selector: 'tb-add-anomaly-detection-dialog',
  templateUrl: './add-anomaly-detection-dialog.component.html',
  styleUrls: ['./add-anomaly-detection-dialog.component.scss'],
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
  ]
})
export class AddAnomalyDetectionDialogComponent {
  devices: string[] = []; // Assume you fetch this from a backend service
  fields: string[] = [];
  _devices: Device[] = [];

  selectedDevice: string | null = null;
  selectedAlgorithm: string;
  selectedName: string;

  // ViewChild('searchBox')

  constructor(public dialogRef: MatDialogRef<AddAnomalyDetectionDialogComponent>, private http: HttpClient) {}

  ngOnInit() {
    // TODO: Fetch devices from backend
    this.devices = [];
    this._devices = [];
    console.log("hello again")

    this.http.get<DevicesRes>(`/api/tenant/devices?pageSize=100&page=0`).subscribe((res) => {
      this._devices = res.data;
      this.devices = this._devices.map((e) => {
        return e.name;
      });
      // this.cd.detectChanges();
    });
  }

  onDeviceSelected(event: any): void {
    // TODO: Fetch fields based on selected device
    console.log('Device selected:', event.value);
  }

  addField(): void {
    this.fields.push('');
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    // TODO: Perform save operation
    console.log({algorithm: this.selectedAlgorithm })
    this.dialogRef.close({
      name: this.selectedName,
      deviceId: {
        id: this._devices.find((e) => e.name == this.selectedDevice).id.id,
        entityType: "DEVICE"
      },
      fields: this.fields,
      attributes: [],
      startDate: 1,
      endDate: 1,
    });
  }
}
