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
package org.thingsboard.server.dao.deviceerror;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.thingsboard.server.common.data.id.DeviceErrorId;
import org.thingsboard.server.common.data.id.DeviceId;
import org.thingsboard.server.common.data.maintenance.DeviceError;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;

import java.sql.Timestamp;
import java.util.List;

@Service
@Slf4j
public class DeviceErrorServiceImpl implements DeviceErrorService {

    @Autowired
    private DeviceErrorDao deviceErrorDao;

    @Override
    public DeviceError saveDeviceError(DeviceError deviceError) {
        log.trace("Executing saveDeviceError [{}]", deviceError);
        return deviceErrorDao.save(deviceError);
    }

    @Override
    public DeviceError findDeviceErrorById(DeviceErrorId id) {
        log.trace("Executing findDeviceErrorById [{}]", id);
        return deviceErrorDao.findById(id.getId());
    }

    @Override
    public PageData<DeviceError> findDeviceErrorsByDeviceId(DeviceId deviceId, Timestamp startTime, Timestamp endTime, PageLink pageLink) {
        log.trace("Executing findDeviceErrorsByDeviceId, deviceId [{}], startTime [{}], endTime [{}], pageLink [{}]",
                deviceId, startTime, endTime, pageLink);
        return deviceErrorDao.findByDeviceId(deviceId, startTime, endTime, pageLink);
    }

    @Override
    public List<DeviceError> findAllDeviceErrorsByDeviceId(DeviceId deviceId) {
        log.trace("Executing findAllDeviceErrorsByDeviceId, deviceId [{}]", deviceId);
        return deviceErrorDao.findAllByDeviceId(deviceId);
    }

    @Override
    public void deleteDeviceError(DeviceErrorId id) {
        log.trace("Executing deleteDeviceError [{}]", id);
        deviceErrorDao.removeById(id.getId());
    }

    @Override
    public void deleteDeviceErrorsByDeviceId(DeviceId deviceId) {
        log.trace("Executing deleteDeviceErrorsByDeviceId [{}]", deviceId);
        deviceErrorDao.removeByDeviceId(deviceId);
    }
}
