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

import org.thingsboard.server.common.data.id.DetectorId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.service.entitiy.SimpleTbEntityService;
import org.thingsboard.server.common.data.Detector;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.exception.ThingsboardException;

public interface TbAnomalyDetectorService extends SimpleTbEntityService<Detector> {
    PageData<Detector> findTenantDetectors(TenantId tenantId, PageLink pageLink);

    Detector findTenantDetector(TenantId tenantId, DetectorId detectorId);

    void deleteDetector(Detector entity, User user);

    // void activate(Detector entity, User user) throws ThingsboardException;
}
