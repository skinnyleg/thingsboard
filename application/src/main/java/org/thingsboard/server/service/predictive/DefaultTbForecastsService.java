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
package org.thingsboard.server.service.predictive;

import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.Forecast;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.audit.ActionType;
import org.thingsboard.server.dao.predictive.ForecastsService;
import org.thingsboard.server.service.entitiy.AbstractTbEntityService;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Service
@Slf4j
public class DefaultTbForecastsService extends AbstractTbEntityService implements TbForecastsService {

    @Autowired
    private ForecastsService forecastsService;

    public PageData<Forecast> findTenantForcasts(TenantId tenantId, PageLink pageLink) {
        return this.forecastsService.findTenantForcasts(tenantId, pageLink);
    }

    @Override
    public Forecast save(Forecast forecast, User user) throws Exception {
        Forecast savedForecast = this.forecastsService.saveForecast(forecast);
        try {
            autoCommit(user, savedForecast.getId());
        } catch (Exception e) {
            logEntityActionService.logEntityAction(savedForecast.getTenantId(), emptyId(EntityType.FORECAST), forecast,
                    ActionType.ADDED, user, e);
            throw e;
        }
        return savedForecast;
    }

    @Override
    public void delete(Forecast entity, User user) {

    }
}