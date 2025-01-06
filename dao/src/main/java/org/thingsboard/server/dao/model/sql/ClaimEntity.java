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
import lombok.EqualsAndHashCode;
import org.thingsboard.server.dao.model.BaseSqlEntity;

import java.util.UUID;

import org.thingsboard.server.common.data.Claim;
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.TenantId;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "claim")
public final class ClaimEntity extends BaseSqlEntity<Claim> {
    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "body")
    private String body;

    @Column(name = "done")
    private boolean done;

    @Column(name = "name")
    private String name;

    public ClaimEntity() {
        super();
    }

    public ClaimEntity(Claim claim) {
        if (claim.getId() != null) {
            this.setId(claim.getId().getId());
        }
        this.createdTime = claim.getCreatedTime();
        if (claim.getTenantId() != null) {
            this.tenantId = claim.getTenantId().getId();
        }
        this.body = claim.getBody();
        this.done = claim.isDone();
        this.name = claim.getName();
    }

    @Override
    public Claim toData() {
        Claim claim = new Claim(new ClaimId(this.getId()));
        claim.setCreatedTime(createdTime);
        if (tenantId != null) {
            claim.setTenantId(TenantId.fromUUID(tenantId));
        }
        claim.setBody(body);
        claim.setDone(done);
        claim.setName(name);
        return claim;
    }
}
