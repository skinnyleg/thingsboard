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
package org.thingsboard.server.dao.devicefailure;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.id.DeviceFailureId;
import org.thingsboard.server.common.data.maintenance.DeviceFailure;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;

import java.sql.Timestamp;
import java.util.List;

@Service
@Slf4j
public class DeviceFailureServiceImpl implements DeviceFailureService {

    @Autowired
    private DeviceFailureDao deviceFailureDao;

    @Override
    public DeviceFailure saveDeviceFailure(DeviceFailure deviceFailure) {
        log.trace("Executing saveDeviceFailure [{}]", deviceFailure);
        return deviceFailureDao.save(deviceFailure);
    }

    @Override
    public DeviceFailure findDeviceFailureById(DeviceFailureId id) {
        log.trace("Executing findDeviceFailureById [{}]", id);
        return deviceFailureDao.findById(id.getId());
    }

    @Override
    public PageData<DeviceFailure> findDeviceFailuresByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime, PageLink pageLink) {
        log.trace("Executing findDeviceFailuresByDeviceId, deviceId [{}], startTime [{}], endTime [{}], pageLink [{}]",
                deviceId, startTime, endTime, pageLink);
        return deviceFailureDao.findByDeviceId(deviceId, startTime, endTime, pageLink);
    }

    @Override
    public List<DeviceFailure> findAllDeviceFailuresByDeviceId(DeviceId deviceId) {
        log.trace("Executing findAllDeviceFailuresByDeviceId, deviceId [{}]", deviceId);
        return deviceFailureDao.findAllByDeviceId(deviceId);
    }

    @Override
    public void deleteDeviceFailure(DeviceFailureId id) {
        log.trace("Executing deleteDeviceFailure [{}]", id);
        deviceFailureDao.removeById(id.getId());
    }

    @Override
    public void deleteDeviceFailuresByDeviceId(DeviceId deviceId) {
        log.trace("Executing deleteDeviceFailuresByDeviceId [{}]", deviceId);
        deviceFailureDao.removeByDeviceId(deviceId);
    }
}
