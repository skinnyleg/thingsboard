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
package org.thingsboard.server.dao.predictive;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.Forecast;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.sql.predictive.ForecastRepository;

import lombok.extern.slf4j.Slf4j;

@Service("ForcastDaoService")
@Slf4j
public class BaseForcastService implements ForecastsService {

    @Autowired
    private ForecastRepository forecastRepository;

    @Override
    public PageData<Forecast> findTenantForcasts(TenantId tenantId, PageLink pageLink) {
        return DaoUtil.toPageData(
                forecastRepository.findForecasts(
                        tenantId.getId(),
                        pageLink.getTextSearch(),
                        DaoUtil.toPageable(pageLink)));
    }
}
