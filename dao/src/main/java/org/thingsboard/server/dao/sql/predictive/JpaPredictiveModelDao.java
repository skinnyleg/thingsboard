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
import org.thingsboard.server.common.data.PredictiveModel;
import org.thingsboard.server.common.data.id.PredictiveModelId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.model.sql.PredictiveModelEntity;
import org.thingsboard.server.dao.predictive.PredictiveModelDao;
import org.thingsboard.server.dao.sql.JpaAbstractDao;
import org.thingsboard.server.dao.util.SqlDao;

import java.util.UUID;

@Component
@SqlDao
public class JpaPredictiveModelDao extends JpaAbstractDao<PredictiveModelEntity, PredictiveModel> implements PredictiveModelDao {

    @Autowired
    private PredictiveModelRepository predictiveModelRepository;

    @Override
    protected Class<PredictiveModelEntity> getEntityClass() {
        return PredictiveModelEntity.class;
    }

    @Override
    protected JpaRepository<PredictiveModelEntity, UUID> getRepository() {
        return predictiveModelRepository;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.PREDICTIVE_MODEL;
    }

    @Override
    public PageData<PredictiveModel> findTenantPredictiveModels(TenantId tenantId, PageLink pageLink) {
        return DaoUtil.toPageData(
                predictiveModelRepository.findPredictiveModels(
                        tenantId.getId(),
                        pageLink.getTextSearch(),
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public PredictiveModel findTenantPredictiveModel(TenantId tenantId, PredictiveModelId predictiveModelId) {
        PredictiveModelEntity predictiveModel = predictiveModelRepository.findPredictiveModel(
                tenantId.getId(),
                predictiveModelId.getId());
        return predictiveModel != null ? predictiveModel.toData() : null;
    }

    @Transactional
    @Override
    public PredictiveModel saveAndFlush(TenantId tenantId, PredictiveModel predictiveModel) {
        PredictiveModel result = save(tenantId, predictiveModel);
        predictiveModelRepository.flush();
        return result;
    }

    @Override
    public Long countPredictiveModelsByDeviceId(TenantId tenantId, UUID deviceId) {
        return predictiveModelRepository.countPredictiveModelsByDeviceId(tenantId.getId(), deviceId);
    }
}
