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

import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
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

  selectedDevice: string | null = null;

  constructor(public dialogRef: MatDialogRef<AddAnomalyDetectionDialogComponent>) {}

  ngOnInit() {
    // TODO: Fetch devices from backend
    this.devices = ['Device A', 'Device B', 'Device C'];
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
    this.dialogRef.close({ name: 'Forecast', device: this.selectedDevice, fields: this.fields });
  }
}
