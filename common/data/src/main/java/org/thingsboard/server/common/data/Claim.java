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
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.UserId;
import org.thingsboard.server.common.data.claim.ClaimTags;
import jakarta.validation.Valid;


@Schema
@Data
@EqualsAndHashCode(callSuper = true)
@Slf4j
public class Claim extends BaseData<ClaimId> implements HasTenantId, HasName {

    public Claim() {
        super();
    }

    public Claim(ClaimId id) {
        super(id);
    }

    public Claim(Claim claim) {
        super(claim);
        this.tenantId = claim.getTenantId();
        this.body = claim.getBody();
        this.done = claim.isDone();
        this.assigneeId = claim.getAssigneeId();
        this.tags = claim.getTags();
    }

    @NoXss
    @Length(fieldName = "name")
    @Schema(description = "Subject of the claim", defaultValue = "")
    private String name;

    @NoXss
    @Length(fieldName = "body")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "User Claim", defaultValue = "User Claim")
    private String body;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Tenant Id.", accessMode = Schema.AccessMode.READ_ONLY)
    private TenantId tenantId;

    @Schema(description = "Active status of the claim", defaultValue = "false")
    private boolean done;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "JSON object with Tenant Id.")
    private UserId assigneeId;

    @Valid
    @Schema(description = "JSON array of tags")
    private transient ClaimTags[] tags;
}
