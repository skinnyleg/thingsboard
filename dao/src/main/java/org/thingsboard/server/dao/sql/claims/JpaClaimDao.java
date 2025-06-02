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
package org.thingsboard.server.dao.sql.claims;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.Claim;
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.model.sql.ClaimEntity;
import org.thingsboard.server.dao.claim.ClaimDao;
import org.thingsboard.server.dao.sql.JpaAbstractDao;
import org.thingsboard.server.dao.util.SqlDao;

import java.util.UUID;

@Component
@SqlDao
public class JpaClaimDao extends JpaAbstractDao<ClaimEntity, Claim> implements ClaimDao {

    @Autowired
    private ClaimRepository claimRepository;

    @Override
    protected Class<ClaimEntity> getEntityClass() {
        return ClaimEntity.class;
    }

    @Override
    protected JpaRepository<ClaimEntity, UUID> getRepository() {
        return claimRepository;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.CLAIM;
    }

    @Override
    public PageData<Claim> findTenantClaims(TenantId tenantId, PageLink pageLink) {
        return DaoUtil.toPageData(
                claimRepository.findClaims(
                        tenantId.getId(),
                        pageLink.getTextSearch(),
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public Claim findTenantClaim(TenantId tenantId, ClaimId claimId) {
        ClaimEntity claim = claimRepository.findClaim(
                tenantId.getId(),
                claimId.getId());
        return claim != null ? claim.toData() : null;
    }

    @Transactional
    @Override
    public Claim saveAndFlush(TenantId tenantId, Claim claim) {
        Claim result = save(tenantId, claim);
        claimRepository.flush();
        return result;
    }

    @Override
    public Claim toggleClaim(TenantId tenantId, ClaimId claimId) {
        ClaimEntity claim = claimRepository.findClaim(tenantId.getId(), claimId.getId());
        claim.setDone(!claim.isDone());
        Claim result = saveAndFlush(tenantId, claim.toData());
        return result;
    }

    @Override
    public Claim assignClaim(TenantId tenantId, UUID assigneeId, ClaimId claimId) {
        ClaimEntity claim = claimRepository.findClaim(tenantId.getId(), claimId.getId());
        claim.setAssigneeId(assigneeId);
        Claim result = saveAndFlush(tenantId, claim.toData());
        return result;
    }

}
