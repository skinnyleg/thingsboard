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

package org.thingsboard.server.controller;

import org.springframework.web.bind.annotation.RestController;
import org.thingsboard.server.queue.util.TbCoreComponent;
import org.thingsboard.server.service.claim.TbClaimsService;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.thingsboard.server.common.data.exception.ThingsboardErrorCode;
import org.thingsboard.server.common.data.exception.ThingsboardException;
import org.thingsboard.server.common.data.id.ClaimId;
import org.thingsboard.server.common.data.id.TenantId;
import org.thingsboard.server.common.data.page.PageData;
import org.thingsboard.server.common.data.page.PageLink;
import org.thingsboard.server.common.data.Claim;
import org.thingsboard.server.config.annotations.ApiOperation;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ResponseBody;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import lombok.extern.slf4j.Slf4j;

import java.util.UUID;
import java.util.Map;

@Slf4j
@RestController
@TbCoreComponent
@RequestMapping("/api")
public class ClaimsController extends BaseController {

    @Autowired
    protected TbClaimsService claimsService;

    @ApiOperation(value = "Get tenant claims", notes = "gets all claims per tenant")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @GetMapping(value = "/claims", params = { "pageSize", "page" })
    @ResponseBody
    public PageData<Claim> getClaims(
            @Parameter(description = "The number of items to return", required = true) @RequestParam int pageSize,
            @Parameter(description = "The page number", required = true) @RequestParam int page,
            @Parameter(description = "The sort property", schema = @Schema(allowableValues = { "name", "createdTime"
            })) @RequestParam(required = false) String sortProperty,
            @Parameter(description = "The sort order", schema = @Schema(allowableValues = { "ASC",
                    "DESC" })) @RequestParam(required = false) String sortOrder,
            @Parameter(description = "The text search") @RequestParam(required = false) String textSearch)
            throws ThingsboardException {
        TenantId tenantId = getCurrentUser().getTenantId();
        PageLink pageLink = createPageLink(pageSize, page, textSearch, sortProperty, sortOrder);
        return checkNotNull(claimsService.findTenantClaims(tenantId, pageLink));
    }

    @ApiOperation(value = "Post claim", notes = "create new claim")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PostMapping(value = "/claims", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public Claim saveClaim(@RequestBody Claim claim) throws Exception {
        TenantId tenantId = getCurrentUser().getTenantId();
        claim.setId(null);
        claim.setTenantId(tenantId);
        claim.setDone(false);
        return checkNotNull(claimsService.save(claim, getCurrentUser()));
    }

    @ApiOperation(value = "Delete claim", notes = "delete a claim")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @DeleteMapping(value = "/claims/{claimId}")
    @ResponseBody
    public void deleteClaim(@PathVariable("claimId") String strClaimId) throws ThingsboardException {
        checkParameter("claimId", strClaimId);
        ClaimId claimId = new ClaimId(toUUID(strClaimId));
        claimsService.delete(new Claim(claimId), getCurrentUser());
    }

    @ApiOperation(value = "Switch claim", notes = "switch claim to done or not done")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PatchMapping(value = "/claims/{claimId}/switch")
    @ResponseBody
    public void toggleClaim(@PathVariable("claimId") String strClaimId) throws Exception {
        checkParameter("claimId", strClaimId);
        ClaimId claimId = new ClaimId(toUUID(strClaimId));
        try {
            claimsService.toggleClaim(new Claim(claimId), getCurrentUser());
        } catch (Exception e) {
            throw new ThingsboardException("Failed to disable Claim", e, ThingsboardErrorCode.GENERAL);
        }
    }

    @ApiOperation(value = "Assign claim", notes = "assign claim")
    @PreAuthorize("hasAnyAuthority('TENANT_ADMIN')")
    @PatchMapping(value = "/claims/{claimId}/assign")
    @ResponseBody
    public void assignClaim(@PathVariable("claimId") String strClaimId, @RequestBody Map<String, String> body) throws Exception {
        checkParameter("claimId", strClaimId);
        ClaimId claimId = new ClaimId(toUUID(strClaimId));

        String assigneeIdStr = body.get("assigneeId");
        if (assigneeIdStr == null) {
          throw new IllegalArgumentException("Missing assigneeId in request body");
        }

        UUID assigneeId = UUID.fromString(assigneeIdStr);

        try {
            claimsService.assignClaim(new Claim(claimId), assigneeId, getCurrentUser());
        } catch (Exception e) {
            throw new ThingsboardException("Failed to assign Claim", e, ThingsboardErrorCode.GENERAL);
        }
    }
}
