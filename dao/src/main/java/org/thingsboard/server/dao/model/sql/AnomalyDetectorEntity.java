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
import org.thingsboard.server.common.data.Detector;
// import org.thingsboard.server.common.data.forecast.ForecastAttribute;
import org.thingsboard.server.common.data.detector.DetectorAttribute;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.dao.util.mapping.JsonConverter;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "anomaly_detector")
public final class AnomalyDetectorEntity extends BaseSqlEntity<Detector> {
    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "name")
    private String name;

    @Column(name = "start_date")
    private Long startDate;

    @Column(name = "end_date")
    private Long endDate;

    // @Column(name = "active")
    // private boolean active;

    @Convert(converter = JsonConverter.class)
    @JdbcType(PostgreSQLJsonPGObjectJsonbType.class)
    @Column(name = "attributes", columnDefinition = "jsonb")
    private JsonNode attributes;

    public AnomalyDetectorEntity() {
        super();
    }

    public AnomalyDetectorEntity(Detector detector) {
        if (detector.getId() != null) {
            this.setId(detector.getId().getId());
        }
        this.createdTime = detector.getCreatedTime();
        if (detector.getTenantId() != null) {
            this.tenantId = detector.getTenantId().getId();
        }
        if (detector.getDeviceId() != null) {
            this.deviceId = detector.getDeviceId().getId();
        }
        this.name = detector.getName();
        this.startDate = detector.getStartDate();
        this.endDate = detector.getEndDate();
        // this.active = detector.isActive();
        this.attributes = JacksonUtil.valueToTree(detector.getAttributes());
    }

    @Override
    public Detector toData() {
        Detector detector = new Detector(new DetectorId(this.getId()));
        detector.setCreatedTime(createdTime);
        if (tenantId != null) {
            detector.setTenantId(TenantId.fromUUID(tenantId));
        }
        if (deviceId != null) {
            detector.setDeviceId(new DeviceId(deviceId));
        }
        detector.setName(name);
        detector.setStartDate(startDate);
        detector.setEndDate(endDate);
        // detector.setActive(active);
        detector.setAttributes(JacksonUtil.convertValue(attributes, DetectorAttribute[].class));
        return detector;
    }
}
