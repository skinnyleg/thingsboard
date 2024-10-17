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
package org.thingsboard.server.dao.sql.predictive;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.thingsboard.server.common.data.EntityType;
import org.thingsboard.server.common.data.Forecast;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.model.sql.ForecastEntity;
import org.thingsboard.server.dao.predictive.ForecastDao;
import org.thingsboard.server.dao.sql.JpaAbstractDao;
import org.thingsboard.server.dao.util.SqlDao;

import java.util.UUID;

@Component
@SqlDao
public class JpaForecastDao extends JpaAbstractDao<ForecastEntity, Forecast> implements ForecastDao {

    @Autowired
    private ForecastRepository forecastRepository;

    @Override
    protected Class<ForecastEntity> getEntityClass() {
        return ForecastEntity.class;
    }

    @Override
    protected JpaRepository<ForecastEntity, UUID> getRepository() {
        return forecastRepository;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.FORECAST;
    }

    @Override
    public PageData<Forecast> findTenantForecasts(TenantId tenantId, PageLink pageLink) {
        return DaoUtil.toPageData(
                forecastRepository.findForecasts(
                        tenantId.getId(),
                        pageLink.getTextSearch(),
                        DaoUtil.toPageable(pageLink)));
    }

    @Transactional
    @Override
    public Forecast saveAndFlush(TenantId tenantId, Forecast forecast) {
        Forecast result = save(tenantId, forecast);
        forecastRepository.flush();
        return result;
    }

}