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
import org.thingsboard.server.common.data.model.ModelLog;
import org.thingsboard.server.common.data.id.ModelLogId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.dao.model.BaseSqlEntity;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

import java.util.UUID;

import static org.thingsboard.server.dao.model.ModelConstants.*;

/**
 * Entity class for model_logs table
 * Stores execution logs from predictive maintenance models
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = MODEL_LOG_TABLE_NAME)
public class ModelLogEntity extends BaseSqlEntity<ModelLog> {

    @Column(name = MODEL_LOG_MODEL_ID_PROPERTY, nullable = false)
    private String modelId;

    @Column(name = MODEL_LOG_TENANT_ID_PROPERTY, nullable = false)
    private UUID tenantId;

    @Column(name = MODEL_LOG_DEVICE_ID_PROPERTY, nullable = false)
    private UUID deviceId;

    @Column(name = MODEL_LOG_TIMESTAMP_PROPERTY, nullable = false)
    private Long timestamp;

    @Column(name = MODEL_LOG_LEVEL_PROPERTY, nullable = false)
    private String logLevel;

    @Column(name = MODEL_LOG_MESSAGE_PROPERTY, nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = MODEL_LOG_SOURCE_PROPERTY)
    private String source;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = MODEL_LOG_METADATA_PROPERTY, columnDefinition = "jsonb")
    private JsonNode metadata;

    public ModelLogEntity() {
        super();
    }

    public ModelLogEntity(ModelLog modelLog) {
        if (modelLog.getId() != null) {
            this.setUuid(modelLog.getId().getId());
        }
        this.createdTime = modelLog.getCreatedTime();
        this.modelId = modelLog.getModelId();
        if (modelLog.getTenantId() != null) {
            this.tenantId = modelLog.getTenantId().getId();
        }
        if (modelLog.getDeviceId() != null) {
            this.deviceId = modelLog.getDeviceId().getId();
        }
        this.timestamp = modelLog.getTimestamp();
        this.logLevel = modelLog.getLogLevel();
        this.message = modelLog.getMessage();
        this.source = modelLog.getSource();
        this.metadata = modelLog.getMetadata();
    }

    @Override
    public ModelLog toData() {
        ModelLog modelLog = new ModelLog(new ModelLogId(getUuid()));
        modelLog.setCreatedTime(timestamp);
        modelLog.setModelId(modelId);
        if (tenantId != null) {
            modelLog.setTenantId(new TenantId(tenantId));
        }
        if (deviceId != null) {
            modelLog.setDeviceId(new DeviceId(deviceId));
        }
        modelLog.setTimestamp(timestamp);
        modelLog.setLogLevel(logLevel);
        modelLog.setMessage(message);
        modelLog.setSource(source);
        modelLog.setMetadata(metadata);
        return modelLog;
    }
}
