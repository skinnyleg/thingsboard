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

import org.thingsboard.server.common.data.PredictiveModel;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.Dao;
import org.thingsboard.server.common.data.id.PredictiveModelId;
import org.thingsboard.server.common.data.id.TenantId;

import java.util.UUID;

public interface PredictiveModelDao extends Dao<PredictiveModel> {
    PageData<PredictiveModel> findTenantPredictiveModels(TenantId tenantId, PageLink pageLink);

    PredictiveModel findTenantPredictiveModel(TenantId tenantId, PredictiveModelId predictiveModelId);

    PredictiveModel saveAndFlush(TenantId tenantId, PredictiveModel predictiveModel);

    Long countPredictiveModelsByDeviceId(TenantId tenantId, UUID deviceId);
}
