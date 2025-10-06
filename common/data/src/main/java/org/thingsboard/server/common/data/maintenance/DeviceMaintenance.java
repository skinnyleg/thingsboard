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
package org.thingsboard.server.common.data.maintenance;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.thingsboard.server.common.data.BaseData;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.DeviceMaintenanceId;

import java.sql.Timestamp;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeviceMaintenance extends BaseData<DeviceMaintenanceId> {

    private DeviceId deviceId;
    private String maintenanceType;
    private Timestamp maintenanceDate;
    private Double durationHours;
    private Double cost;
    private String technician;
    private String description;
    private String partsReplaced;
    private JsonNode actionsPerformed;
    private Timestamp nextMaintenanceDate;
    private JsonNode metadata;
    private Timestamp createdAt;

    public DeviceMaintenance() {
        super();
    }

    public DeviceMaintenance(DeviceMaintenanceId id) {
        super(id);
    }

    public DeviceMaintenance(DeviceMaintenance deviceMaintenance) {
        super(deviceMaintenance);
        this.deviceId = deviceMaintenance.getDeviceId();
        this.maintenanceType = deviceMaintenance.getMaintenanceType();
        this.maintenanceDate = deviceMaintenance.getMaintenanceDate();
        this.durationHours = deviceMaintenance.getDurationHours();
        this.cost = deviceMaintenance.getCost();
        this.technician = deviceMaintenance.getTechnician();
        this.description = deviceMaintenance.getDescription();
        this.partsReplaced = deviceMaintenance.getPartsReplaced();
        this.actionsPerformed = deviceMaintenance.getActionsPerformed();
        this.nextMaintenanceDate = deviceMaintenance.getNextMaintenanceDate();
        this.metadata = deviceMaintenance.getMetadata();
        this.createdAt = deviceMaintenance.getCreatedAt();
    }
}
