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

import lombok.Data;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.EqualsAndHashCode;
import org.thingsboard.server.dao.model.BaseSqlEntity;

import java.util.UUID;

import jakarta.persistence.Convert;
import org.hibernate.annotations.JdbcType;
import org.hibernate.dialect.PostgreSQLJsonPGObjectJsonbType;
import org.thingsboard.common.util.JacksonUtil;
import org.thingsboard.server.common.data.PredictiveModel;
import org.thingsboard.server.common.data.predictivemodel.PredictiveModelAttribute;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.PredictiveModelId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "predictive_maintenance_config")
public final class PredictiveModelEntity extends BaseSqlEntity<PredictiveModel> {
    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "name")
    private String name;

    @Column(name = "forecast_algorithm")
    private String forecastAlgorithm;

    @Column(name = "forecast_start_date")
    private Long forecastStartDate;

    @Column(name = "forecast_end_date")
    private Long forecastEndDate;

    @Column(name = "anomaly_algorithm")
    private String anomalyAlgorithm;

    @Column(name = "anomaly_start_date")
    private Long anomalyStartDate;

    @Column(name = "anomaly_end_date")
    private Long anomalyEndDate;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = "attributes", columnDefinition = "jsonb")
    private JsonNode attributes;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = "view_preferences", columnDefinition = "jsonb")
    private JsonNode viewPreferences;

    public PredictiveModelEntity() {
        super();
    }

    public PredictiveModelEntity(PredictiveModel predictiveModel) {
        if (predictiveModel.getId() != null) {
            this.setId(predictiveModel.getId().getId());
        }
        this.createdTime = predictiveModel.getCreatedTime();
        if (predictiveModel.getTenantId() != null) {
            this.tenantId = predictiveModel.getTenantId().getId();
        }
        if (predictiveModel.getDeviceId() != null) {
            this.deviceId = predictiveModel.getDeviceId().getId();
        }
        this.name = predictiveModel.getName();
        this.attributes = JacksonUtil.valueToTree(predictiveModel.getAttributes());
        this.forecastAlgorithm = predictiveModel.getForecastAlgorithm();
        this.forecastStartDate = predictiveModel.getForecastStartDate();
        this.forecastEndDate = predictiveModel.getForecastEndDate();
        this.anomalyAlgorithm = predictiveModel.getAnomalyAlgorithm();
        this.anomalyStartDate = predictiveModel.getAnomalyStartDate();
        this.anomalyEndDate = predictiveModel.getAnomalyEndDate();
        // Handle view preferences - parse JSON string to JsonNode
        if (predictiveModel.getViewPreferences() != null) {
            try {
                this.viewPreferences = JacksonUtil.toJsonNode(predictiveModel.getViewPreferences());
            } catch (Exception e) {
                // If parsing fails, set default with multi-select format
                this.viewPreferences = JacksonUtil.toJsonNode("{\"selectedViews\": [\"forecast\", \"anomalies\"]}");
            }
        } else {
            this.viewPreferences = JacksonUtil.toJsonNode("{\"selectedViews\": [\"forecast\", \"anomalies\"]}");
        }
    }

    @Override
    public PredictiveModel toData() {
        PredictiveModel predictiveModel = new PredictiveModel(new PredictiveModelId(this.getId()));
        predictiveModel.setCreatedTime(createdTime);
        if (tenantId != null) {
            predictiveModel.setTenantId(TenantId.fromUUID(tenantId));
        }
        if (deviceId != null) {
            predictiveModel.setDeviceId(new DeviceId(deviceId));
        }
        predictiveModel.setName(name);
        predictiveModel.setAttributes(JacksonUtil.convertValue(attributes, PredictiveModelAttribute[].class));
        predictiveModel.setForecastAlgorithm(forecastAlgorithm);
        predictiveModel.setForecastStartDate(forecastStartDate);
        predictiveModel.setForecastEndDate(forecastEndDate);
        predictiveModel.setAnomalyAlgorithm(anomalyAlgorithm);
        predictiveModel.setAnomalyStartDate(anomalyStartDate);
        predictiveModel.setAnomalyEndDate(anomalyEndDate);
        // Convert JsonNode back to JSON string for view preferences
        if (viewPreferences != null) {
            predictiveModel.setViewPreferences(viewPreferences.toString());
        } else {
            predictiveModel.setViewPreferences("{\"selectedViews\": [\"forecast\", \"anomalies\"]}");
        }
        return predictiveModel;
    }
}
