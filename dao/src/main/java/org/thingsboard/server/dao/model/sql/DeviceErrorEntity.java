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
import org.thingsboard.server.common.data.id.DeviceErrorId;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceError;
import org.thingsboard.server.dao.model.BaseSqlEntity;
import org.thingsboard.server.dao.model.ModelConstants;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

import java.sql.Timestamp;
import java.util.UUID;

import static org.thingsboard.server.dao.model.ModelConstants.*;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = DEVICE_ERROR_TABLE_NAME)
public class DeviceErrorEntity extends BaseSqlEntity<DeviceError> {

    @Column(name = ModelConstants.DEVICE_ERROR_DEVICE_ID_PROPERTY)
    private UUID deviceId;

    @Column(name = ModelConstants.DEVICE_ERROR_TIME_PROPERTY)
    private Timestamp errorTime;

    @Column(name = ModelConstants.DEVICE_ERROR_CODE_PROPERTY)
    private String errorCode;

    @Column(name = ModelConstants.DEVICE_ERROR_TYPE_PROPERTY)
    private String errorType;

    @Column(name = ModelConstants.DEVICE_ERROR_SEVERITY_PROPERTY)
    private String errorSeverity;

    @Column(name = ModelConstants.DEVICE_ERROR_DESCRIPTION_PROPERTY, columnDefinition = "TEXT")
    private String errorDescription;

    @Column(name = ModelConstants.DEVICE_ERROR_COMPONENT_PROPERTY)
    private String component;

    @Column(name = ModelConstants.DEVICE_ERROR_RECOVERY_TIME_PROPERTY)
    private Timestamp recoveryTime;

    @Column(name = ModelConstants.DEVICE_ERROR_WAS_AUTO_RECOVERED_PROPERTY)
    private Boolean wasAutoRecovered;

    @Column(name = ModelConstants.DEVICE_ERROR_LED_TO_FAILURE_PROPERTY)
    private Boolean ledToFailure;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = ModelConstants.DEVICE_ERROR_METADATA_PROPERTY, columnDefinition = "jsonb")
    private JsonNode metadata;

    @Column(name = ModelConstants.DEVICE_ERROR_CREATED_AT_PROPERTY)
    private Timestamp createdAt;

    public DeviceErrorEntity() {
        super();
    }

    public DeviceErrorEntity(DeviceError deviceError) {
        if (deviceError.getId() != null) {
            this.setUuid(deviceError.getId().getId());
        }
        if (deviceError.getDeviceId() != null) {
            this.deviceId = deviceError.getDeviceId().getId();
        }
        this.errorTime = deviceError.getErrorTime();
        this.errorCode = deviceError.getErrorCode();
        this.errorType = deviceError.getErrorType();
        this.errorSeverity = deviceError.getErrorSeverity();
        this.errorDescription = deviceError.getErrorDescription();
        this.component = deviceError.getComponent();
        this.recoveryTime = deviceError.getRecoveryTime();
        this.wasAutoRecovered = deviceError.getWasAutoRecovered();
        this.ledToFailure = deviceError.getLedToFailure();
        this.metadata = deviceError.getMetadata();
        this.createdAt = deviceError.getCreatedAt();
    }

    @Override
    public DeviceError toData() {
        DeviceError deviceError = new DeviceError(new DeviceErrorId(this.getUuid()));
        if (deviceId != null) {
            deviceError.setDeviceId(new DeviceId(deviceId));
        }
        deviceError.setErrorTime(errorTime);
        deviceError.setErrorCode(errorCode);
        deviceError.setErrorType(errorType);
        deviceError.setErrorSeverity(errorSeverity);
        deviceError.setErrorDescription(errorDescription);
        deviceError.setComponent(component);
        deviceError.setRecoveryTime(recoveryTime);
        deviceError.setWasAutoRecovered(wasAutoRecovered);
        deviceError.setLedToFailure(ledToFailure);
        deviceError.setMetadata(metadata);
        deviceError.setCreatedAt(createdAt);
        return deviceError;
    }
}
