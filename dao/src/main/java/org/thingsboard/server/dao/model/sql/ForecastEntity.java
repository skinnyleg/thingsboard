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
import org.thingsboard.server.common.data.Forecast;
import org.thingsboard.server.common.data.forecast.ForecastAttribute;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "forecast")
public final class ForecastEntity extends BaseSqlEntity<Forecast> {
    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "name")
    private String name;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = "attributes", columnDefinition = "jsonb")
    private JsonNode attributes;

    public ForecastEntity() {
        super();
    }

    public ForecastEntity(Forecast forecast) {
        if (forecast.getId() != null) {
            this.setId(forecast.getId().getId());
        }
        this.createdTime = forecast.getCreatedTime();
        if (forecast.getTenantId() != null) {
            this.tenantId = forecast.getTenantId().getId();
        }
        if (forecast.getDeviceId() != null) {
            this.deviceId = forecast.getDeviceId().getId();
        }
        this.name = forecast.getName();
        this.attributes = JacksonUtil.valueToTree(forecast.getAttributes());
    }

    @Override
    public Forecast toData() {
        Forecast forecast = new Forecast(new ForecastId(this.getId()));
        forecast.setCreatedTime(createdTime);
        if (tenantId != null) {
            forecast.setTenantId(TenantId.fromUUID(tenantId));
        }
        if (deviceId != null) {
            forecast.setDeviceId(new DeviceId(deviceId));
        }
        forecast.setName(name);
        forecast.setAttributes(JacksonUtil.convertValue(attributes, ForecastAttribute[].class));
        return forecast;
    }
}
