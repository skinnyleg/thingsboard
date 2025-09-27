/**
 * Copyright © 2016-2024 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Order } from "@app/modules/home/models/predictive-maintenance.models";
import { CommonModule } from "@angular/common";
import { MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";

export interface ModelSelectionDialogData {
  models: Order[];
  currentModelId: string;
  getModelDisplayName: (model: any) => string;
}

@Component({
  selector: "tb-model-selection-dialog",
  templateUrl: "./model-selection-dialog.component.html",
  styleUrls: ["./model-selection-dialog.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    TranslateModule,
  ],
})
export class ModelSelectionDialogComponent implements OnInit {
  filteredModels: Order[] = [];
  searchTerm = "";

  constructor(
    public dialogRef: MatDialogRef<ModelSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModelSelectionDialogData
  ) {}

  ngOnInit(): void {
    this.filteredModels = [...this.data.models];
  }

  onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.filteredModels = [...this.data.models];
    } else {
      this.filteredModels = this.data.models.filter(
        (model) =>
          this.data
            .getModelDisplayName(model)
            .toLowerCase()
            .includes(this.searchTerm.toLowerCase()) ||
          model.device.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          model.date.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  selectModel(model: Order): void {
    this.dialogRef.close(model);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  isCurrentModel(model: Order): boolean {
    return model.trueId === this.data.currentModelId;
  }
}
