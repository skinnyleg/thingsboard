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
package org.thingsboard.server.dao.devicemaintenance;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.DeviceMaintenanceId;
import org.thingsboard.server.common.data.maintenance.DeviceMaintenance;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;

import java.sql.Timestamp;
import java.util.List;

@Service
@Slf4j
public class DeviceMaintenanceServiceImpl implements DeviceMaintenanceService {

    @Autowired
    private DeviceMaintenanceDao deviceMaintenanceDao;

    @Override
    public DeviceMaintenance saveDeviceMaintenance(DeviceMaintenance deviceMaintenance) {
        log.trace("Executing saveDeviceMaintenance [{}]", deviceMaintenance);
        return deviceMaintenanceDao.save(deviceMaintenance);
    }

    @Override
    public DeviceMaintenance findDeviceMaintenanceById(DeviceMaintenanceId id) {
        log.trace("Executing findDeviceMaintenanceById [{}]", id);
        return deviceMaintenanceDao.findById(id.getId());
    }

    @Override
    public PageData<DeviceMaintenance> findDeviceMaintenanceByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime, PageLink pageLink) {
        log.trace("Executing findDeviceMaintenanceByDeviceId, deviceId [{}], startTime [{}], endTime [{}], pageLink [{}]",
                deviceId, startTime, endTime, pageLink);
        return deviceMaintenanceDao.findByDeviceId(deviceId, startTime, endTime, pageLink);
    }

    @Override
    public List<DeviceMaintenance> findAllDeviceMaintenanceByDeviceId(DeviceId deviceId) {
        log.trace("Executing findAllDeviceMaintenanceByDeviceId, deviceId [{}]", deviceId);
        return deviceMaintenanceDao.findAllByDeviceId(deviceId);
    }

    @Override
    public void deleteDeviceMaintenance(DeviceMaintenanceId id) {
        log.trace("Executing deleteDeviceMaintenance [{}]", id);
        deviceMaintenanceDao.removeById(id.getId());
    }

    @Override
    public void deleteDeviceMaintenanceByDeviceId(DeviceId deviceId) {
        log.trace("Executing deleteDeviceMaintenanceByDeviceId [{}]", deviceId);
        deviceMaintenanceDao.removeByDeviceId(deviceId);
    }
}
