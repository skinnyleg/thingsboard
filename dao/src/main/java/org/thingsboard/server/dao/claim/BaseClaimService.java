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
package org.thingsboard.server.dao.claim;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.model.sql.ClaimEntity;
import org.thingsboard.server.common.data.Claim;

import lombok.extern.slf4j.Slf4j;

@Service("ClaimDaoService")
@Slf4j
public class BaseClaimService implements ClaimsService {

    @Autowired
    private ClaimDao claimDao;

    @Override
    public PageData<Claim> findTenantClaims(TenantId tenantId, PageLink pageLink) {
        return claimDao.findTenantClaims(tenantId, pageLink);
    }

    @Override
    public Claim saveClaim(Claim forecast) {
        return claimDao.saveAndFlush(forecast.getTenantId(), forecast);
    }

    @Override
    public void deleteClaim(TenantId tenantId, ClaimId claimId) {
        try {
            claimDao.removeById(tenantId, claimId.getId());
        } catch (Exception e) {
            throw e;
        }
    }

    @Override
    public void toggleClaim(TenantId tenantId, ClaimId claimId) {
        try {
            Claim result = claimDao.toggleClaim(tenantId, claimId);
            log.info("Activated forecast: [{}]", result);
        } catch (Exception e) {
            throw e;
        }
    }
}
