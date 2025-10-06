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
package org.thingsboard.server.dao.sql.devicefailure;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceFailure;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.devicefailure.DeviceFailureDao;
import org.thingsboard.server.dao.model.sql.DeviceFailureEntity;
import org.thingsboard.server.dao.sql.JpaAbstractDao;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JpaDeviceFailureDao extends JpaAbstractDao<DeviceFailureEntity, DeviceFailure> implements DeviceFailureDao {

    @Autowired
    private DeviceFailureRepository deviceFailureRepository;

    @Override
    protected Class<DeviceFailureEntity> getEntityClass() {
        return DeviceFailureEntity.class;
    }

    @Override
    protected JpaRepository<DeviceFailureEntity, UUID> getRepository() {
        return deviceFailureRepository;
    }

    @Override
    public DeviceFailure save(DeviceFailure deviceFailure) {
        log.debug("Save device failure [{}] ", deviceFailure);
        saveAndFlush(null, deviceFailure);
        log.debug("Saved device failure [{}] ", deviceFailure);
        return deviceFailure;
    }

    @Override
    public DeviceFailure findById(UUID id) {
        log.debug("Search device failure by id [{}]", id);
        DeviceFailureEntity entity = deviceFailureRepository.findById(id).orElse(null);
        return entity != null ? entity.toData() : null;
    }

    @Override
    public PageData<DeviceFailure> findByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime,
            PageLink pageLink) {
        log.debug("Search device failures by deviceId [{}] with time window [{} - {}]", deviceId, startTime, endTime);
        return DaoUtil.toPageData(
                deviceFailureRepository.findByDeviceIdAndTimeWindow(
                        deviceId.getId(),
                        startTime,
                        endTime,
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public List<DeviceFailure> findAllByDeviceId(DeviceId deviceId) {
        log.debug("Search all device failures by deviceId [{}]", deviceId);
        return deviceFailureRepository.findAllByDeviceId(deviceId.getId())
                .stream()
                .map(DeviceFailureEntity::toData)
                .collect(Collectors.toList());
    }

    @Override
    public boolean removeById(UUID id) {
        log.debug("Delete device failure by id [{}]", id);
        deviceFailureRepository.deleteById(id);
        return true;
    }

    @Override
    public void removeByDeviceId(DeviceId deviceId) {
        log.debug("Delete all device failures by deviceId [{}]", deviceId);
        deviceFailureRepository.deleteByDeviceId(deviceId.getId());
    }
}
