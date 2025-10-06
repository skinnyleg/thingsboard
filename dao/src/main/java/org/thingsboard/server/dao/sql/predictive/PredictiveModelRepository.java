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
package org.thingsboard.server.dao.sql.predictive;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.thingsboard.server.dao.model.sql.PredictiveModelEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PredictiveModelRepository extends JpaRepository<PredictiveModelEntity, UUID> {
        @Query("SELECT pm FROM PredictiveModelEntity pm WHERE pm.tenantId = :tenantId " +
                        "AND (:textSearch IS NULL OR ilike(pm.name, CONCAT('%', :textSearch, '%')) = true)")
        Page<PredictiveModelEntity> findPredictiveModels(
                        @Param("tenantId") UUID tenantId,
                        @Param("textSearch") String textSearch,
                        Pageable pageable);

        @Query("SELECT pm FROM PredictiveModelEntity pm WHERE pm.tenantId = :tenantId " +
                        "AND pm.id = :predictiveModelId")
        PredictiveModelEntity findPredictiveModel(
                        @Param("tenantId") UUID tenantId,
                        @Param("predictiveModelId") UUID predictiveModelId);

        @Query("SELECT COUNT(pm) FROM PredictiveModelEntity pm WHERE pm.tenantId = :tenantId " +
                        "AND pm.deviceId = :deviceId")
        Long countPredictiveModelsByDeviceId(
                        @Param("tenantId") UUID tenantId,
                        @Param("deviceId") UUID deviceId);
}
