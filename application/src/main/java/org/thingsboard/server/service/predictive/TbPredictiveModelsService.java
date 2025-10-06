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

import org.thingsboard.server.common.data.id.PredictiveModelId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.service.entitiy.SimpleTbEntityService;
import org.thingsboard.server.common.data.PredictiveModel;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.DeviceWithModelsCount;

public interface TbPredictiveModelsService extends SimpleTbEntityService<PredictiveModel> {
    PageData<PredictiveModel> findTenantPredictiveModels(TenantId tenantId, PageLink pageLink);

    PredictiveModel findTenantPredictiveModel(TenantId tenantId, PredictiveModelId predictiveModelId);

    void deletePredictiveModel(PredictiveModel entity, User user);

    PageData<DeviceWithModelsCount> findDevicesWithModelsCount(TenantId tenantId, PageLink pageLink,
            boolean withModelsOnly);
}
