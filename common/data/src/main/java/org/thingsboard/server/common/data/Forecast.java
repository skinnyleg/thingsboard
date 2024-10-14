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
import lombok.extern.slf4j.Slf4j;
import io.swagger.v3.oas.annotations.media.Schema;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.id.EntityId;

@Schema
@Data
@Slf4j
public class Forecast implements HasTenantId {
    // @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON
    // object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    // private EntityId id;

    // @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON
    // object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    // private EntityId label;

    // @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON
    // object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    // private EntityId createdTime;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Tenant Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private TenantId tenantId;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private EntityId entityId;

    // @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON
    // object with Entity Id.", accessMode = Schema.AccessMode.READ_ONLY)
    // private EntityId jsonb;
}