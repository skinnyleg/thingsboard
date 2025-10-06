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
import org.thingsboard.server.common.data.id.DeviceFailureId;

import java.sql.Timestamp;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeviceFailure extends BaseData<DeviceFailureId> {

    private DeviceId deviceId;
    private Timestamp failureTime;
    private Timestamp detectionTime;
    private Timestamp resolvedTime;
    private String failureType;
    private String failureSeverity;
    private String failureDescription;
    private String rootCause;
    private Double downtimeHours;
    private Double repairCost;
    private JsonNode replacedParts;
    private JsonNode maintenanceActions;
    private Boolean wasPredicted;
    private Double predictionLeadTimeHours;
    private JsonNode metadata;
    private Timestamp createdAt;

    public DeviceFailure() {
        super();
    }

    public DeviceFailure(DeviceFailureId id) {
        super(id);
    }

    public DeviceFailure(DeviceFailure deviceFailure) {
        super(deviceFailure);
        this.deviceId = deviceFailure.getDeviceId();
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
}
