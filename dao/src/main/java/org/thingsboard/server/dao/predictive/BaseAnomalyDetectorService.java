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
import org.thingsboard.server.common.data.id.ForecastId;
import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.model.sql.ForecastEntity;
import org.thingsboard.server.common.data.Detector;

import lombok.extern.slf4j.Slf4j;

@Service("AnomalyDetectorDaoService")
@Slf4j
public class BaseAnomalyDetectorService implements AnomalyDetectorService {

    @Autowired
    private AnomalyDetectorDao detectorDao;

    @Override
    public PageData<Detector> findTenantDetectors(TenantId tenantId, PageLink pageLink) {
        return detectorDao.findTenantDetectors(tenantId, pageLink);
    }

    @Override
    public Detector findTenantDetector(TenantId tenantId, DetectorId detectorId) {
        return detectorDao.findTenantDetector(tenantId, detectorId);
    }

    @Override
    public Detector saveDetector(Detector detector) {
        return detectorDao.saveAndFlush(detector.getTenantId(), detector);
    }

    @Override
    public void deleteDetector(TenantId tenantId, DetectorId detectorId) {
        try {
            detectorDao.removeById(tenantId, detectorId.getId());
        } catch (Exception e) {
            throw e;
        }
    }

    // @Override
    // public void activateForecast(TenantId tenantId, ForecastId forecastId) {
    //     try {
    //         Forecast result = forecastDao.activateForecast(tenantId, forecastId);
    //         log.info("Activated forecast: [{}]", result);
    //     } catch (Exception e) {
    //         throw e;
    //     }
    // }
}
