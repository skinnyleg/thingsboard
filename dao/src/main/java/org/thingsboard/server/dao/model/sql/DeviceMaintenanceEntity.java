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
package org.thingsboard.server.dao.model.sql;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLJsonPGObjectJsonbType;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.DeviceMaintenanceId;
import org.thingsboard.server.common.data.maintenance.DeviceMaintenance;
import org.thingsboard.server.dao.model.BaseSqlEntity;
import org.thingsboard.server.dao.model.ModelConstants;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

import java.sql.Timestamp;
import java.util.UUID;

import static org.thingsboard.server.dao.model.ModelConstants.*;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = DEVICE_MAINTENANCE_TABLE_NAME)
public class DeviceMaintenanceEntity extends BaseSqlEntity<DeviceMaintenance> {

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_DEVICE_ID_PROPERTY)
    private UUID deviceId;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_TYPE_PROPERTY)
    private String maintenanceType;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_DATE_PROPERTY)
    private Timestamp maintenanceDate;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_DURATION_HOURS_PROPERTY)
    private Double durationHours;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_COST_PROPERTY)
    private Double cost;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_TECHNICIAN_PROPERTY)
    private String technician;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_DESCRIPTION_PROPERTY, columnDefinition = "TEXT")
    private String description;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_PARTS_REPLACED_PROPERTY)
    private String partsReplaced;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_MAINTENANCE_ACTIONS_PERFORMED_PROPERTY, columnDefinition = "jsonb")
    private JsonNode actionsPerformed;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_NEXT_MAINTENANCE_DATE_PROPERTY)
    private Timestamp nextMaintenanceDate;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_MAINTENANCE_METADATA_PROPERTY, columnDefinition = "jsonb")
    private JsonNode metadata;

    @Column(name = ModelConstants.DEVICE_MAINTENANCE_CREATED_AT_PROPERTY)
    private Timestamp createdAt;

    public DeviceMaintenanceEntity() {
        super();
    }

    public DeviceMaintenanceEntity(DeviceMaintenance deviceMaintenance) {
        if (deviceMaintenance.getId() != null) {
            this.setUuid(deviceMaintenance.getId().getId());
        }
        if (deviceMaintenance.getDeviceId() != null) {
            this.deviceId = deviceMaintenance.getDeviceId().getId();
        }
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

    @Override
    public DeviceMaintenance toData() {
        DeviceMaintenance deviceMaintenance = new DeviceMaintenance(new DeviceMaintenanceId(this.getUuid()));
        if (deviceId != null) {
            deviceMaintenance.setDeviceId(new DeviceId(deviceId));
        }
        deviceMaintenance.setMaintenanceType(maintenanceType);
        deviceMaintenance.setMaintenanceDate(maintenanceDate);
        deviceMaintenance.setDurationHours(durationHours);
        deviceMaintenance.setCost(cost);
        deviceMaintenance.setTechnician(technician);
        deviceMaintenance.setDescription(description);
        deviceMaintenance.setPartsReplaced(partsReplaced);
        deviceMaintenance.setActionsPerformed(actionsPerformed);
        deviceMaintenance.setNextMaintenanceDate(nextMaintenanceDate);
        deviceMaintenance.setMetadata(metadata);
        deviceMaintenance.setCreatedAt(createdAt);
        return deviceMaintenance;
    }
}
