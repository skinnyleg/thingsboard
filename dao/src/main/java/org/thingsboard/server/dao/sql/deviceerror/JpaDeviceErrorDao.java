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
package org.thingsboard.server.dao.sql.deviceerror;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceError;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.deviceerror.DeviceErrorDao;
import org.thingsboard.server.dao.model.sql.DeviceErrorEntity;
import org.thingsboard.server.dao.sql.JpaAbstractDao;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JpaDeviceErrorDao extends JpaAbstractDao<DeviceErrorEntity, DeviceError> implements DeviceErrorDao {

    @Autowired
    private DeviceErrorRepository deviceErrorRepository;

    @Override
    protected Class<DeviceErrorEntity> getEntityClass() {
        return DeviceErrorEntity.class;
    }

    @Override
    protected JpaRepository<DeviceErrorEntity, UUID> getRepository() {
        return deviceErrorRepository;
    }

    @Override
    public DeviceError save(DeviceError deviceError) {
        log.debug("Save device error [{}] ", deviceError);
        saveAndFlush(null, deviceError);
        log.debug("Saved device error [{}] ", deviceError);
        return deviceError;
    }

    @Override
    public DeviceError findById(UUID id) {
        log.debug("Search device error by id [{}]", id);
        DeviceErrorEntity entity = deviceErrorRepository.findById(id).orElse(null);
        return entity != null ? entity.toData() : null;
    }

    @Override
    public PageData<DeviceError> findByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime,
            PageLink pageLink) {
        log.debug("Search device errors by deviceId [{}] with time window [{} - {}]", deviceId, startTime, endTime);
        return DaoUtil.toPageData(
                deviceErrorRepository.findByDeviceIdAndTimeWindow(
                        deviceId.getId(),
                        startTime,
                        endTime,
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public List<DeviceError> findAllByDeviceId(DeviceId deviceId) {
        log.debug("Search all device errors by deviceId [{}]", deviceId);
        return deviceErrorRepository.findAllByDeviceId(deviceId.getId())
                .stream()
                .map(DeviceErrorEntity::toData)
                .collect(Collectors.toList());
    }

    @Override
    public boolean removeById(UUID id) {
        log.debug("Delete device error by id [{}]", id);
        deviceErrorRepository.deleteById(id);
        return true;
    }

    @Override
    public void removeByDeviceId(DeviceId deviceId) {
        log.debug("Delete all device errors by deviceId [{}]", deviceId);
        deviceErrorRepository.deleteByDeviceId(deviceId.getId());
    }
}
