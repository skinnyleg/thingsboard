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

import org.thingsboard.server.common.data.Forecast;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "forecast")
public final class ForecastEntity extends BaseSqlEntity<Forecast> {
    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "jsonb")
    private JsonNode jsonb;

    @Column(name = "label")
    private String label;

    @Column(name = "created_time")
    private long createdTime;

    @Column(name = "id")
    private UUID id;

    @Override
    public Forecast toData() {
        Forecast forecast = new Forecast();
        return forecast;
    }
}
