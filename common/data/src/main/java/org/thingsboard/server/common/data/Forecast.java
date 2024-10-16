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
import org.thingsboard.server.common.data.forecast.ForecastAttribute;
import org.thingsboard.server.common.data.id.EntityId;
import jakarta.validation.Valid;

@Schema
@Data
@EqualsAndHashCode(callSuper = true)
@Slf4j
public class Forecast extends BaseData<ForecastId> implements HasTenantId, HasName {

    public Forecast() {
        super();
    }

    public Forecast(ForecastId id) {
        super(id);
    }

    @NoXss
    @Length(fieldName = "name")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Unique Forecast Name", accessMode = Schema.AccessMode.READ_ONLY)
    private String name;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Tenant Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private TenantId tenantId;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private EntityId entityId;

    @Valid
    @Schema(description = "JSON array of attributes")
    private transient ForecastAttribute[] attributes;
}