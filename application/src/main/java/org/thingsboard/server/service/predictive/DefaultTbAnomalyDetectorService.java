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
import org.thingsboard.server.common.data.Detector;
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.audit.ActionType;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.dao.predictive.AnomalyDetectorService;
import org.thingsboard.server.service.entitiy.AbstractTbEntityService;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Service
@Slf4j
public class DefaultTbAnomalyDetectorService extends AbstractTbEntityService implements TbAnomalyDetectorService {

    @Autowired
    private AnomalyDetectorService anomalyDetectorService;

    public PageData<Detector> findTenantDetectors(TenantId tenantId, PageLink pageLink) {
        return this.anomalyDetectorService.findTenantDetectors(tenantId, pageLink);
    }

    public Detector findTenantDetector(TenantId tenantId, DetectorId detectorId) {
        return this.anomalyDetectorService.findTenantDetector(tenantId, detectorId);
    }

    @Override
    public Detector save(Detector detector, User user) throws Exception {
        Detector savedDetector = this.anomalyDetectorService.saveDetector(detector);
        try {
            autoCommit(user, savedDetector.getId());
        } catch (Exception e) {
            logEntityActionService.logEntityAction(savedDetector.getTenantId(), emptyId(EntityType.DETECTOR), detector,
                    ActionType.ADDED, user, e);
            throw e;
        }
        return savedDetector;
    }

    @Override
    public void delete(Detector entity, User user) {
        deleteDetector(entity, user);
    }

    public void deleteDetector(Detector entity, User user) {
        ActionType actionType = ActionType.DELETED;
        TenantId tenantId = user.getTenantId();
        DetectorId detectorId = entity.getId();
        try {
            this.anomalyDetectorService.deleteDetector(tenantId, detectorId);
            logEntityActionService.logEntityAction(tenantId, detectorId, actionType, user, null);
        } catch (Exception e) {
            logEntityActionService.logEntityAction(tenantId, forecastId, actionType, user, e);
            throw e;
        }
    }

    public void activate(Detector forecast, User user) throws ThingsboardException {
        this.forecastsService.activateForecast(user.getTenantId(), forecast.getId());
    }
}
