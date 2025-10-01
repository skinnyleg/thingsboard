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
import org.thingsboard.server.common.data.Detector;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.model.sql.AnomalyDetectorEntity;
import org.thingsboard.server.dao.predictive.AnomalyDetectorDao;
import org.thingsboard.server.dao.sql.JpaAbstractDao;
import org.thingsboard.server.dao.util.SqlDao;

import java.util.UUID;

@Component
@SqlDao
public class JpaDetectorDao extends JpaAbstractDao<AnomalyDetectorEntity, Detector> implements AnomalyDetectorDao {

    @Autowired
    private AnomalyDetectorRepository anomalyDetectorRepository;

    @Override
    protected Class<AnomalyDetectorEntity> getEntityClass() {
        return AnomalyDetectorEntity.class;
    }

    @Override
    protected JpaRepository<AnomalyDetectorEntity, UUID> getRepository() {
        return anomalyDetectorRepository;
    }

    @Override
    public EntityType getEntityType() {
        return EntityType.DETECTOR;
    }

    @Override
    public PageData<Detector> findTenantDetectors(TenantId tenantId, PageLink pageLink) {
        return DaoUtil.toPageData(
                anomalyDetectorRepository.findDetectors(
                        tenantId.getId(),
                        pageLink.getTextSearch(),
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public Detector findTenantDetector(TenantId tenantId, DetectorId detectorId) {
         AnomalyDetectorEntity detector = anomalyDetectorRepository.findDetector(
                tenantId.getId(),
                detectorId.getId());
        return detector != null ? detector.toData() : null;
    }

    @Transactional
    @Override
    public Detector saveAndFlush(TenantId tenantId, Detector detector) {
        Detector result = save(tenantId, detector);
        anomalyDetectorRepository.flush();
        return result;
    }

    // @Override
    // public Detector activateDetector(TenantId tenantId, DetectorId detectorId) {
    //     DetectorEntity detector = anomalyDetectorRepository.findDetector(tenantId.getId(), detectorId.getId());
    //     // detector.setActive(true);
    //     Detector result = saveAndFlush(tenantId, detector.toData());
    //     return result;
    // }

}