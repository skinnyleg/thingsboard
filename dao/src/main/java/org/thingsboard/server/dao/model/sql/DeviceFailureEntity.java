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
import org.thingsboard.server.common.data.id.DeviceFailureId;
import org.thingsboard.server.common.data.maintenance.DeviceFailure;
import org.thingsboard.server.dao.model.BaseSqlEntity;
import org.thingsboard.server.dao.model.ModelConstants;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

import java.sql.Timestamp;
import java.util.UUID;

import static org.thingsboard.server.dao.model.ModelConstants.*;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = DEVICE_FAILURE_TABLE_NAME)
public class DeviceFailureEntity extends BaseSqlEntity<DeviceFailure> {

    @Column(name = ModelConstants.DEVICE_FAILURE_DEVICE_ID_PROPERTY)
    private UUID deviceId;

    @Column(name = ModelConstants.DEVICE_FAILURE_TIME_PROPERTY)
    private Timestamp failureTime;

    @Column(name = ModelConstants.DEVICE_FAILURE_DETECTION_TIME_PROPERTY)
    private Timestamp detectionTime;

    @Column(name = ModelConstants.DEVICE_FAILURE_RESOLVED_TIME_PROPERTY)
    private Timestamp resolvedTime;

    @Column(name = ModelConstants.DEVICE_FAILURE_TYPE_PROPERTY)
    private String failureType;

    @Column(name = ModelConstants.DEVICE_FAILURE_SEVERITY_PROPERTY)
    private String failureSeverity;

    @Column(name = ModelConstants.DEVICE_FAILURE_DESCRIPTION_PROPERTY, columnDefinition = "TEXT")
    private String failureDescription;

    @Column(name = ModelConstants.DEVICE_FAILURE_ROOT_CAUSE_PROPERTY)
    private String rootCause;

    @Column(name = ModelConstants.DEVICE_FAILURE_DOWNTIME_HOURS_PROPERTY)
    private Double downtimeHours;

    @Column(name = ModelConstants.DEVICE_FAILURE_REPAIR_COST_PROPERTY)
    private Double repairCost;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_FAILURE_REPLACED_PARTS_PROPERTY, columnDefinition = "jsonb")
    private JsonNode replacedParts;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_FAILURE_MAINTENANCE_ACTIONS_PROPERTY, columnDefinition = "jsonb")
    private JsonNode maintenanceActions;

    @Column(name = ModelConstants.DEVICE_FAILURE_WAS_PREDICTED_PROPERTY)
    private Boolean wasPredicted;

    @Column(name = ModelConstants.DEVICE_FAILURE_PREDICTION_LEAD_TIME_HOURS_PROPERTY)
    private Double predictionLeadTimeHours;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_FAILURE_METADATA_PROPERTY, columnDefinition = "jsonb")
    private JsonNode metadata;

    @Column(name = ModelConstants.DEVICE_FAILURE_CREATED_AT_PROPERTY)
    private Timestamp createdAt;

    public DeviceFailureEntity() {
        super();
    }

    public DeviceFailureEntity(DeviceFailure deviceFailure) {
        if (deviceFailure.getId() != null) {
            this.setUuid(deviceFailure.getId().getId());
        }
        if (deviceFailure.getDeviceId() != null) {
            this.deviceId = deviceFailure.getDeviceId().getId();
        }
        this.failureTime = deviceFailure.getFailureTime();
        this.detectionTime = deviceFailure.getDetectionTime();
        this.resolvedTime = deviceFailure.getResolvedTime();
        this.failureType = deviceFailure.getFailureType();
        this.failureSeverity = deviceFailure.getFailureSeverity();
        this.failureDescription = deviceFailure.getFailureDescription();
        this.rootCause = deviceFailure.getRootCause();
        this.downtimeHours = deviceFailure.getDowntimeHours();
        this.repairCost = deviceFailure.getRepairCost();
        this.replacedParts = deviceFailure.getReplacedParts();
        this.maintenanceActions = deviceFailure.getMaintenanceActions();
        this.wasPredicted = deviceFailure.getWasPredicted();
        this.predictionLeadTimeHours = deviceFailure.getPredictionLeadTimeHours();
        this.metadata = deviceFailure.getMetadata();
        this.createdAt = deviceFailure.getCreatedAt();
    }

    @Override
    public DeviceFailure toData() {
        DeviceFailure deviceFailure = new DeviceFailure(new DeviceFailureId(this.getUuid()));
        if (deviceId != null) {
            deviceFailure.setDeviceId(new DeviceId(deviceId));
        }
        deviceFailure.setFailureTime(failureTime);
        deviceFailure.setDetectionTime(detectionTime);
        deviceFailure.setResolvedTime(resolvedTime);
        deviceFailure.setFailureType(failureType);
        deviceFailure.setFailureSeverity(failureSeverity);
        deviceFailure.setFailureDescription(failureDescription);
        deviceFailure.setRootCause(rootCause);
        deviceFailure.setDowntimeHours(downtimeHours);
        deviceFailure.setRepairCost(repairCost);
        deviceFailure.setReplacedParts(replacedParts);
        deviceFailure.setMaintenanceActions(maintenanceActions);
        deviceFailure.setWasPredicted(wasPredicted);
        deviceFailure.setPredictionLeadTimeHours(predictionLeadTimeHours);
        deviceFailure.setMetadata(metadata);
        deviceFailure.setCreatedAt(createdAt);
        return deviceFailure;
    }
}
