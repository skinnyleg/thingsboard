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
import org.thingsboard.server.common.data.PredictiveModel;
import org.thingsboard.server.common.data.Device;
import org.thingsboard.server.common.data.DeviceWithModelsCount;
import org.thingsboard.server.common.data.id.PredictiveModelId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.page.SortOrder.Direction;
import org.thingsboard.server.common.data.User;
import org.thingsboard.server.common.data.audit.ActionType;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.dao.predictive.PredictiveModelsService;
import org.thingsboard.server.dao.device.DeviceService;
import org.thingsboard.server.service.entitiy.AbstractTbEntityService;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;

import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Service
@Slf4j
public class DefaultTbPredictiveModelsService extends AbstractTbEntityService implements TbPredictiveModelsService {

    @Autowired
    private PredictiveModelsService predictiveModelsService;

    @Autowired
    private DeviceService deviceService;

    public PageData<PredictiveModel> findTenantPredictiveModels(TenantId tenantId, PageLink pageLink) {
        return this.predictiveModelsService.findTenantPredictiveModels(tenantId, pageLink);
    }

    public PredictiveModel findTenantPredictiveModel(TenantId tenantId, PredictiveModelId predictiveModelId) {
        return this.predictiveModelsService.findTenantPredictiveModel(tenantId, predictiveModelId);
    }

    @Override
    public PredictiveModel save(PredictiveModel predictiveModel, User user) throws Exception {
        PredictiveModel savedPredictiveModel = this.predictiveModelsService.savePredictiveModel(predictiveModel);
        try {
            autoCommit(user, savedPredictiveModel.getId());
        } catch (Exception e) {
            logEntityActionService.logEntityAction(savedPredictiveModel.getTenantId(), emptyId(EntityType.PREDICTIVE_MODEL), predictiveModel,
                    ActionType.ADDED, user, e);
            throw e;
        }
        return savedPredictiveModel;
    }

    @Override
    public void delete(PredictiveModel entity, User user) {
        deletePredictiveModel(entity, user);
    }

    public void deletePredictiveModel(PredictiveModel entity, User user) {
        ActionType actionType = ActionType.DELETED;
        TenantId tenantId = user.getTenantId();
        PredictiveModelId predictiveModelId = entity.getId();
        try {
            this.predictiveModelsService.deletePredictiveModel(tenantId, predictiveModelId);
            logEntityActionService.logEntityAction(tenantId, predictiveModelId, actionType, user, null);
        } catch (Exception e) {
            logEntityActionService.logEntityAction(tenantId, predictiveModelId, actionType, user, e);
            throw e;
        }
    }

    @Override
    public PageData<DeviceWithModelsCount> findDevicesWithModelsCount(TenantId tenantId, PageLink pageLink,
            boolean withModelsOnly) {
        PageData<Device> devicesPage = deviceService.findDevicesByTenantId(tenantId, pageLink);

        List<DeviceWithModelsCount> devicesWithModels = new ArrayList<>();
        for (Device device : devicesPage.getData()) {
            Long modelsCount = predictiveModelsService.countPredictiveModelsByDeviceId(tenantId, device.getId().getId());
            // Filter devices if withModelsOnly is true
            if (!withModelsOnly || modelsCount > 0) {
                devicesWithModels.add(new DeviceWithModelsCount(device, modelsCount));
            }
        }

        // Sort by modelsCount if specified
        if (pageLink.getSortOrder() != null && "modelsCount".equals(pageLink.getSortOrder().getProperty())) {
            devicesWithModels.sort((a, b) -> {
                int comparison = a.getModelsCount().compareTo(b.getModelsCount());
                return pageLink.getSortOrder().getDirection() == Direction.DESC ? -comparison : comparison;
            });
        }

        // Adjust total elements and pages when filtering
        long totalElements = withModelsOnly ? devicesWithModels.size() : devicesPage.getTotalElements();
        int totalPages = withModelsOnly ? (int) Math.ceil((double) totalElements / pageLink.getPageSize())
                : devicesPage.getTotalPages();
        boolean hasNext = withModelsOnly ? (pageLink.getPage() + 1) < totalPages : devicesPage.hasNext();

        return new PageData<>(
                devicesWithModels,
                totalPages,
                totalElements,
                hasNext);
    }
}
