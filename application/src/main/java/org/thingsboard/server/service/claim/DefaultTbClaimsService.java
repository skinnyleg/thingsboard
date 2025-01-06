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
package org.thingsboard.server.service.claim;

import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.Claim;
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.audit.ActionType;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.dao.claim.ClaimsService;
import org.thingsboard.server.service.entitiy.AbstractTbEntityService;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Service
@Slf4j
public class DefaultTbClaimsService extends AbstractTbEntityService implements TbClaimsService {

    @Autowired
    private ClaimsService claimsService;

    public PageData<Claim> findTenantClaims(TenantId tenantId, PageLink pageLink) {
        return this.claimsService.findTenantClaims(tenantId, pageLink);
    }

    @Override
    public Claim save(Claim claim, User user) throws Exception {
        Claim savedClaim = this.claimsService.saveClaim(claim);
        try {
            autoCommit(user, savedClaim.getId());
        } catch (Exception e) {
            logEntityActionService.logEntityAction(savedClaim.getTenantId(), emptyId(EntityType.CLAIM), claim,
                    ActionType.ADDED, user, e);
            throw e;
        }
        return savedClaim;
    }
    
    @Override
    public void delete(Claim entity, User user) {
        deleteForecast(entity, user);
    }

    public void deleteForecast(Claim entity, User user) {
        ActionType actionType = ActionType.DELETED;
        TenantId tenantId = user.getTenantId();
        ClaimId forecastId = entity.getId();
        try {
            this.claimsService.deleteClaim(tenantId, forecastId);
            logEntityActionService.logEntityAction(tenantId, forecastId, actionType, user, null);
        } catch (Exception e) {
            logEntityActionService.logEntityAction(tenantId, forecastId, actionType, user, e);
            throw e;
        }
    }

    public void disable(Claim claim, User user) throws ThingsboardException {
        this.claimsService.disableClaim(user.getTenantId(), claim.getId());
    }
}
