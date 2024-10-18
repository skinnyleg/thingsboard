import { Component, OnInit, ViewChild } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatSortModule } from "@angular/material/sort";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";
import { CommonModule } from "@angular/common";
import { MatDialog } from "@angular/material/dialog";
import { AddAnomalyDetectionDialogComponent } from "./add-anomaly-detection-dialog/add-anomaly-detection-dialog.component";
import { Router } from "@angular/router";
import {
  ELEMENT_DATA,
  Order,
} from "@app/modules/home/models/predictive-maintenance.models";

@Component({
  selector: "tb-anomaly-detection",
  templateUrl: "./anomaly-detection.component.html",
  styleUrls: ["./anomaly-detection.component.scss"],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTooltipModule,
  ],
})
export class AnomalyDetectionComponent implements OnInit {
  displayedColumns: string[] = [
    "id",
    "device",
    // "user",
    "date",
    "status",
    "action",
  ];
  dataSource = new MatTableDataSource(ELEMENT_DATA);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  constructor(public dialog: MatDialog, private router: Router) {}

  ngOnInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
  openAddAnomalyDetectionDialog(): void {
    const dialogRef = this.dialog.open(AddAnomalyDetectionDialogComponent, {
      width: "600px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log("Dialog closed", result);
    });
  }

  openAnomalyDetectionModel(row: Order) {
    this.router.navigateByUrl(`/PM/anomaly-detection/${row.id}`);
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}
