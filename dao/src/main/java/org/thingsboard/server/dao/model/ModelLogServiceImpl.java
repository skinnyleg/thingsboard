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
package org.thingsboard.server.dao.model;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.ModelLogId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.model.ModelLog;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.model.sql.ModelLogEntity;
import org.thingsboard.server.dao.sql.model.ModelLogRepository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class ModelLogServiceImpl implements ModelLogService {

    @Autowired
    private ModelLogRepository modelLogRepository;

    @Override
    @Transactional
    public ModelLog save(TenantId tenantId, ModelLog modelLog) {
        log.trace("Executing save [{}]", modelLog);

        if (modelLog.getId() == null) {
            modelLog.setId(new ModelLogId(UUID.randomUUID()));
        }

        if (modelLog.getCreatedTime() == 0L) {
            modelLog.setCreatedTime(System.currentTimeMillis());
        }

        // Validate tenant ID
        if (modelLog.getTenantId() == null) {
            log.warn("TenantId is null for modelLog: {}", modelLog);
            modelLog.setTenantId(tenantId);
        }

        ModelLogEntity entity = new ModelLogEntity(modelLog);
        ModelLogEntity savedEntity = modelLogRepository.save(entity);

        return savedEntity.toData();
    }

    @Override
    public PageData<ModelLog> findByModelIdAndTimeWindow(
            String modelId,
            Long startTs,
            Long endTs,
            String logLevel,
            String source,
            PageLink pageLink) {

        log.trace(
                "Executing findByModelIdAndTimeWindow [{}], startTs: {}, endTs: {}, logLevel: {}, source: {}, pageLink: {}",
                modelId, startTs, endTs, logLevel, source, pageLink);

        Pageable pageable = PageRequest.of(
                pageLink.getPage(),
                pageLink.getPageSize(),
                Sort.by(Sort.Direction.DESC, ModelConstants.MODEL_LOG_TIMESTAMP_PROPERTY));

        Page<ModelLogEntity> entityPage = modelLogRepository.findByModelIdAndTimeWindow(
                modelId, startTs, endTs, logLevel, source, pageable);

        List<ModelLog> modelLogs = new ArrayList<>();
        for (ModelLogEntity entity : entityPage.getContent()) {
            modelLogs.add(entity.toData());
        }

        return new PageData<>(modelLogs, entityPage.getTotalPages(), entityPage.getTotalElements(),
                entityPage.hasNext());
    }

    @Override
    public long countByModelIdAndTimeWindow(
            String modelId,
            Long startTs,
            Long endTs,
            String logLevel,
            String source) {

        log.trace("Executing countByModelIdAndTimeWindow [{}], startTs: {}, endTs: {}, logLevel: {}, source: {}",
                modelId, startTs, endTs, logLevel, source);

        return modelLogRepository.countByModelIdAndTimeWindow(
                modelId, startTs, endTs, logLevel, source);
    }

    @Override
    public ModelLog findById(TenantId tenantId, ModelLogId modelLogId) {
        log.trace("Executing findById [{}]", modelLogId);

        return modelLogRepository.findById(modelLogId.getId())
                .map(ModelLogEntity::toData)
                .orElse(null);
    }

    @Override
    @Transactional
    public int deleteOldLogs(int retentionDays) {
        log.info("Executing deleteOldLogs with retention days: {}", retentionDays);

        long cutoffTimestamp = Instant.now()
                .minus(retentionDays, ChronoUnit.DAYS)
                .toEpochMilli();

        try {
            modelLogRepository.deleteByTimestampBefore(cutoffTimestamp);
            log.info("Deleted logs older than {} days (cutoff timestamp: {})", retentionDays, cutoffTimestamp);
            return 0; // Spring Data doesn't return count for void delete methods
        } catch (Exception e) {
            log.error("Error deleting old logs", e);
            throw e;
        }
    }

    @Override
    @Transactional
    public void deleteByModelId(String modelId) {
        log.info("Executing deleteByModelId [{}]", modelId);

        try {
            modelLogRepository.deleteByModelId(modelId);
            log.info("Deleted all logs for model: {}", modelId);
        } catch (Exception e) {
            log.error("Error deleting logs for model: {}", modelId, e);
            throw e;
        }
    }

    @Override
    public PageData<ModelLog> findByTenantId(TenantId tenantId, PageLink pageLink) {
        log.trace("Executing findByTenantId [{}], pageLink: {}", tenantId, pageLink);

        Pageable pageable = PageRequest.of(
                pageLink.getPage(),
                pageLink.getPageSize(),
                Sort.by(Sort.Direction.DESC, ModelConstants.MODEL_LOG_TIMESTAMP_PROPERTY));

        Page<ModelLogEntity> entityPage = modelLogRepository.findByTenantId(
                tenantId.getId(), pageable);

        List<ModelLog> modelLogs = new ArrayList<>();
        for (ModelLogEntity entity : entityPage.getContent()) {
            modelLogs.add(entity.toData());
        }

        return new PageData<>(modelLogs, entityPage.getTotalPages(), entityPage.getTotalElements(),
                entityPage.hasNext());
    }

    @Override
    public PageData<ModelLog> findByDeviceId(DeviceId deviceId, PageLink pageLink) {
        log.trace("Executing findByDeviceId [{}], pageLink: {}", deviceId, pageLink);

        Pageable pageable = PageRequest.of(
                pageLink.getPage(),
                pageLink.getPageSize(),
                Sort.by(Sort.Direction.DESC, ModelConstants.MODEL_LOG_TIMESTAMP_PROPERTY));

        Page<ModelLogEntity> entityPage = modelLogRepository.findByDeviceId(
                deviceId.getId(), pageable);

        List<ModelLog> modelLogs = new ArrayList<>();
        for (ModelLogEntity entity : entityPage.getContent()) {
            modelLogs.add(entity.toData());
        }

        return new PageData<>(modelLogs, entityPage.getTotalPages(), entityPage.getTotalElements(),
                entityPage.hasNext());
    }
}
