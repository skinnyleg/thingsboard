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
import org.thingsboard.server.common.data.id.DeviceErrorId;
import org.thingsboard.server.common.data.id.DeviceId;

import java.sql.Timestamp;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeviceError extends BaseData<DeviceErrorId> {

    private DeviceId deviceId;
    private Timestamp errorTime;
    private String errorCode;
    private String errorType;
    private String errorSeverity;
    private String errorDescription;
    private String component;
    private Timestamp recoveryTime;
    private Boolean wasAutoRecovered;
    private Boolean ledToFailure;
    private JsonNode metadata;
    private Timestamp createdAt;

    public DeviceError() {
        super();
    }

    public DeviceError(DeviceErrorId id) {
        super(id);
    }

    public DeviceError(DeviceError deviceError) {
        super(deviceError);
        this.deviceId = deviceError.getDeviceId();
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
}
