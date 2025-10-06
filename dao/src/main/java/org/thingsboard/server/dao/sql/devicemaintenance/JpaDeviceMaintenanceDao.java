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
package org.thingsboard.server.dao.sql.devicemaintenance;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceMaintenance;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.dao.DaoUtil;
import org.thingsboard.server.dao.devicemaintenance.DeviceMaintenanceDao;
import org.thingsboard.server.dao.model.sql.DeviceMaintenanceEntity;
import org.thingsboard.server.dao.sql.JpaAbstractDao;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JpaDeviceMaintenanceDao extends JpaAbstractDao<DeviceMaintenanceEntity, DeviceMaintenance> implements DeviceMaintenanceDao {

    @Autowired
    private DeviceMaintenanceRepository deviceMaintenanceRepository;

    @Override
    protected Class<DeviceMaintenanceEntity> getEntityClass() {
        return DeviceMaintenanceEntity.class;
    }

    @Override
    protected JpaRepository<DeviceMaintenanceEntity, UUID> getRepository() {
        return deviceMaintenanceRepository;
    }

    @Override
    public DeviceMaintenance save(DeviceMaintenance deviceMaintenance) {
        log.debug("Save device maintenance [{}] ", deviceMaintenance);
        saveAndFlush(null, deviceMaintenance);
        log.debug("Saved device maintenance [{}] ", deviceMaintenance);
        return deviceMaintenance;
    }

    @Override
    public DeviceMaintenance findById(UUID id) {
        log.debug("Search device maintenance by id [{}]", id);
        DeviceMaintenanceEntity entity = deviceMaintenanceRepository.findById(id).orElse(null);
        return entity != null ? entity.toData() : null;
    }

    @Override
    public PageData<DeviceMaintenance> findByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime,
            PageLink pageLink) {
        log.debug("Search device maintenance records by deviceId [{}] with time window [{} - {}]", deviceId, startTime, endTime);
        return DaoUtil.toPageData(
                deviceMaintenanceRepository.findByDeviceIdAndTimeWindow(
                        deviceId.getId(),
                        startTime,
                        endTime,
                        DaoUtil.toPageable(pageLink)));
    }

    @Override
    public List<DeviceMaintenance> findAllByDeviceId(DeviceId deviceId) {
        log.debug("Search all device maintenance records by deviceId [{}]", deviceId);
        return deviceMaintenanceRepository.findAllByDeviceId(deviceId.getId())
                .stream()
                .map(DeviceMaintenanceEntity::toData)
                .collect(Collectors.toList());
    }

    @Override
    public boolean removeById(UUID id) {
        log.debug("Delete device maintenance by id [{}]", id);
        deviceMaintenanceRepository.deleteById(id);
        return true;
    }

    @Override
    public void removeByDeviceId(DeviceId deviceId) {
        log.debug("Delete all device maintenance records by deviceId [{}]", deviceId);
        deviceMaintenanceRepository.deleteByDeviceId(deviceId.getId());
    }
}
