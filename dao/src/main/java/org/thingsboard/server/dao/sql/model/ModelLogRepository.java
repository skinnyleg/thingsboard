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
package org.thingsboard.server.dao.sql.model;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.thingsboard.server.dao.model.sql.ModelLogEntity;

import java.util.UUID;

/**
 * Repository for ModelLog entities
 * Provides data access methods for model logs
 */
@Repository
public interface ModelLogRepository extends JpaRepository<ModelLogEntity, UUID> {

    /**
     * Find logs by model ID and time window with optional filters
     */
    @Query("SELECT ml FROM ModelLogEntity ml WHERE ml.modelId = :modelId " +
            "AND ml.timestamp BETWEEN :startTs AND :endTs " +
            "AND (:logLevel IS NULL OR ml.logLevel = :logLevel) " +
            "AND (:source IS NULL OR ml.source LIKE :source) " +
            "ORDER BY ml.timestamp DESC")
    Page<ModelLogEntity> findByModelIdAndTimeWindow(
            @Param("modelId") String modelId,
            @Param("startTs") Long startTs,
            @Param("endTs") Long endTs,
            @Param("logLevel") String logLevel,
            @Param("source") String source,
            Pageable pageable);

    /**
     * Count logs by model ID and time window with optional filters
     */
    @Query("SELECT COUNT(ml) FROM ModelLogEntity ml WHERE ml.modelId = :modelId " +
            "AND ml.timestamp BETWEEN :startTs AND :endTs " +
            "AND (:logLevel IS NULL OR ml.logLevel = :logLevel) " +
            "AND (:source IS NULL OR ml.source LIKE :source)")
    long countByModelIdAndTimeWindow(
            @Param("modelId") String modelId,
            @Param("startTs") Long startTs,
            @Param("endTs") Long endTs,
            @Param("logLevel") String logLevel,
            @Param("source") String source);

    /**
     * Delete logs older than specified timestamp
     */
    @Modifying
    @Query("DELETE FROM ModelLogEntity ml WHERE ml.timestamp < :cutoffTimestamp")
    void deleteByTimestampBefore(@Param("cutoffTimestamp") Long cutoffTimestamp);

    /**
     * Delete logs by model ID
     */
    @Modifying
    @Query("DELETE FROM ModelLogEntity ml WHERE ml.modelId = :modelId")
    void deleteByModelId(@Param("modelId") String modelId);

    /**
     * Find logs by tenant ID
     */
    @Query("SELECT ml FROM ModelLogEntity ml WHERE ml.tenantId = :tenantId ORDER BY ml.timestamp DESC")
    Page<ModelLogEntity> findByTenantId(@Param("tenantId") UUID tenantId, Pageable pageable);

    /**
     * Find logs by device ID
     */
    @Query("SELECT ml FROM ModelLogEntity ml WHERE ml.deviceId = :deviceId ORDER BY ml.timestamp DESC")
    Page<ModelLogEntity> findByDeviceId(@Param("deviceId") UUID deviceId, Pageable pageable);
}
