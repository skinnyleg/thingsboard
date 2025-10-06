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
package org.thingsboard.server.common.data.model;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.thingsboard.server.common.data.BaseData;
import org.thingsboard.server.common.data.HasTenantId;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.ModelLogId;
import org.thingsboard.server.common.data.id.TenantId;

/**
 * Represents a log entry from a predictive maintenance model
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class ModelLog extends BaseData<ModelLogId> implements HasTenantId {

    private String modelId;
    private TenantId tenantId;
    private DeviceId deviceId;
    private Long timestamp;
    private String logLevel; // INFO, WARN, ERROR
    private String message;
    private String source; // 'activation', 'ForecastModel', 'AnomalyPredictor'
    private JsonNode metadata;

    public ModelLog() {
        super();
    }

    public ModelLog(ModelLogId id) {
        super(id);
    }

    public ModelLog(ModelLog modelLog) {
        super(modelLog);
        this.modelId = modelLog.getModelId();
        this.tenantId = modelLog.getTenantId();
        this.deviceId = modelLog.getDeviceId();
        this.timestamp = modelLog.getTimestamp();
        this.logLevel = modelLog.getLogLevel();
        this.message = modelLog.getMessage();
        this.source = modelLog.getSource();
        this.metadata = modelLog.getMetadata();
    }
}
