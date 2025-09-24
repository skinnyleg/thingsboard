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
package org.thingsboard.server.common.data;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;
import io.swagger.v3.oas.annotations.media.Schema;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.validation.Length;
import org.thingsboard.server.common.data.validation.NoXss;
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.detector.DetectorAttribute;
import org.thingsboard.server.common.data.id.DeviceId;
import jakarta.validation.Valid;

@Schema
@Data
@EqualsAndHashCode(callSuper = true)
@Slf4j
public class Detector extends BaseData<DetectorId> implements HasTenantId, HasName {

    public Detector() {
        super();
    }

    public Detector(DetectorId id) {
        super(id);
    }

    public Detector(Detector detector) {
        super(detector);
        this.tenantId = detector.getTenantId();
        this.deviceId = detector.getDeviceId();
        this.name = detector.getName();
        this.attributes = detector.getAttributes();
        this.startDate = detector.getStartDate();
        this.endDate = detector.getEndDate();
    }

    @NoXss
    @Length(fieldName = "name")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Unique Detector Name", defaultValue = "[device] Detector")
    private String name;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Tenant Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private TenantId tenantId;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Device Id.")
    private DeviceId deviceId;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "String value representing the attribute start date", example = "1758637622822")
    private Long startDate;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "String value representing the attribute end date", example = "1758637622822")
    private Long endDate;

    // @Schema(description = "Active status of the detector", accessMode = Schema.AccessMode.READ_ONLY, defaultValue = "false")
    // private boolean active;

    @Valid
    @Schema(description = "JSON array of attributes")
    private transient DetectorAttribute[] attributes;
}