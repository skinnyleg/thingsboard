///
/// Copyright © 2016-2024 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Injectable } from "@angular/core";
import { defaultHttpOptionsFromConfig, RequestConfig } from "./http-utils";
import { Observable, ReplaySubject } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { PageLink } from "@shared/models/page/page-link";
import { PageData } from "@shared/models/page/page-data";
import {
  ClaimRequest,
  ClaimResult,
  Device,
  DeviceCredentials,
  DeviceInfo,
  DeviceInfoQuery,
  DeviceSearchQuery,
  PublishTelemetryCommand,
} from "@shared/models/device.models";
import { EntitySubtype } from "@shared/models/entity-type.models";
import { AuthService } from "@core/auth/auth.service";
import {
  BulkImportRequest,
  BulkImportResult,
} from "@shared/import-export/import-export.models";
import { PersistentRpc, RpcStatus } from "@shared/models/rpc.models";
import { ResourcesService } from "@core/services/resources.service";

@Injectable({
  providedIn: "root",
})
export class DeviceService {
  constructor(
    private http: HttpClient,
    private resourcesService: ResourcesService
  ) {}

  public getDeviceInfosByQuery(
    deviceInfoQuery: DeviceInfoQuery,
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("1 === ", deviceInfoQuery);
    return this.http.get<PageData<DeviceInfo>>(
      `/api${deviceInfoQuery.toQuery()}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getTenantDeviceInfos(
    pageLink: PageLink,
    type: string = "",
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("2");
    return this.http.get<PageData<DeviceInfo>>(
      `/api/tenant/deviceInfos${pageLink.toQuery()}&type=${type}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getTenantDeviceInfosByDeviceProfileId(
    pageLink: PageLink,
    deviceProfileId: string = "",
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("3");
    return this.http.get<PageData<DeviceInfo>>(
      `/api/tenant/deviceInfos${pageLink.toQuery()}&deviceProfileId=${deviceProfileId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getCustomerDeviceInfos(
    customerId: string,
    pageLink: PageLink,
    type: string = "",
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("4");
    return this.http.get<PageData<DeviceInfo>>(
      `/api/customer/${customerId}/deviceInfos${pageLink.toQuery()}&type=${type}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getCustomerDeviceInfosByDeviceProfileId(
    customerId: string,
    pageLink: PageLink,
    deviceProfileId: string = "",
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("5");
    return this.http.get<PageData<DeviceInfo>>(
      `/api/customer/${customerId}/deviceInfos${pageLink.toQuery()}&deviceProfileId=${deviceProfileId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDevice(
    deviceId: string,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("getDevice === ", deviceId);
    console.log("6");
    return this.http.get<Device>(
      `/api/device/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDevices(
    deviceIds: Array<string>,
    config?: RequestConfig
  ): Observable<Array<Device>> {
    console.log("8");
    console.log("getDevices === ", deviceIds);
    return this.http.get<Array<Device>>(
      `/api/devices?deviceIds=${deviceIds.join(",")}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDeviceInfo(
    deviceId: string,
    config?: RequestConfig
  ): Observable<DeviceInfo> {
    console.log("9");
    return this.http.get<DeviceInfo>(
      `/api/device/info/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public saveDevice(
    device: Device,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("10");
    return this.http.post<Device>(
      "/api/device",
      device,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public saveDeviceWithCredentials(
    device: Device,
    credentials: DeviceCredentials,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("11");
    return this.http.post<Device>(
      "/api/device-with-credentials",
      {
        device,
        credentials,
      },
      defaultHttpOptionsFromConfig(config)
    );
  }

  public deleteDevice(deviceId: string, config?: RequestConfig) {
    console.log("12");
    return this.http.delete(
      `/api/device/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDeviceTypes(
    config?: RequestConfig
  ): Observable<Array<EntitySubtype>> {
    console.log("13");
    return this.http.get<Array<EntitySubtype>>(
      "/api/device/types",
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDeviceCredentials(
    deviceId: string,
    sync: boolean = false,
    config?: RequestConfig
  ): Observable<DeviceCredentials> {
    console.log("14");
    const url = `/api/device/${deviceId}/credentials`;
    if (sync) {
      const responseSubject = new ReplaySubject<DeviceCredentials>();
      const request = new XMLHttpRequest();
      request.open("GET", url, false);
      request.setRequestHeader("Accept", "application/json, text/plain, */*");
      const jwtToken = AuthService.getJwtToken();
      if (jwtToken) {
        request.setRequestHeader("X-Authorization", "Bearer " + jwtToken);
      }
      request.send(null);
      if (request.status === 200) {
        const credentials = JSON.parse(
          request.responseText
        ) as DeviceCredentials;
        responseSubject.next(credentials);
      } else {
        responseSubject.error(null);
      }
      return responseSubject.asObservable();
    } else {
      return this.http.get<DeviceCredentials>(
        url,
        defaultHttpOptionsFromConfig(config)
      );
    }
  }

  public saveDeviceCredentials(
    deviceCredentials: DeviceCredentials,
    config?: RequestConfig
  ): Observable<DeviceCredentials> {
    console.log("15");
    return this.http.post<DeviceCredentials>(
      "/api/device/credentials",
      deviceCredentials,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public makeDevicePublic(
    deviceId: string,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("16");
    return this.http.post<Device>(
      `/api/customer/public/device/${deviceId}`,
      null,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public assignDeviceToCustomer(
    customerId: string,
    deviceId: string,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("17");
    return this.http.post<Device>(
      `/api/customer/${customerId}/device/${deviceId}`,
      null,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public unassignDeviceFromCustomer(deviceId: string, config?: RequestConfig) {
    console.log("18");
    return this.http.delete(
      `/api/customer/device/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public sendOneWayRpcCommand(
    deviceId: string,
    requestBody: any,
    config?: RequestConfig
  ): Observable<any> {
    console.log("19");
    return this.http.post<any>(
      `/api/rpc/oneway/${deviceId}`,
      requestBody,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public sendTwoWayRpcCommand(
    deviceId: string,
    requestBody: any,
    config?: RequestConfig
  ): Observable<any> {
    console.log("20");
    return this.http.post<any>(
      `/api/rpc/twoway/${deviceId}`,
      requestBody,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getPersistedRpc(
    rpcId: string,
    fullResponse = false,
    config?: RequestConfig
  ): Observable<PersistentRpc> {
    console.log("21");
    return this.http.get<PersistentRpc>(
      `/api/rpc/persistent/${rpcId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public deletePersistedRpc(rpcId: string, config?: RequestConfig) {
    console.log("22");
    return this.http.delete<PersistentRpc>(
      `/api/rpc/persistent/${rpcId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getPersistedRpcRequests(
    deviceId: string,
    pageLink: PageLink,
    rpcStatus?: RpcStatus,
    config?: RequestConfig
  ): Observable<PageData<PersistentRpc>> {
    console.log("23");
    let url = `/api/rpc/persistent/device/${deviceId}${pageLink.toQuery()}`;
    if (rpcStatus && rpcStatus.length) {
      url += `&rpcStatus=${rpcStatus}`;
    }
    return this.http.get<PageData<PersistentRpc>>(
      url,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public findByQuery(
    query: DeviceSearchQuery,
    config?: RequestConfig
  ): Observable<Array<Device>> {
    console.log("24");
    return this.http.post<Array<Device>>(
      "/api/devices",
      query,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public findByName(
    deviceName: string,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("25");
    return this.http.get<Device>(
      `/api/tenant/devices?deviceName=${deviceName}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public claimDevice(
    deviceName: string,
    claimRequest: ClaimRequest,
    config?: RequestConfig
  ): Observable<ClaimResult> {
    console.log("26");
    return this.http.post<ClaimResult>(
      `/api/customer/device/${deviceName}/claim`,
      claimRequest,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public unclaimDevice(deviceName: string, config?: RequestConfig) {
    console.log("27");
    return this.http.delete(
      `/api/customer/device/${deviceName}/claim`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public assignDeviceToEdge(
    edgeId: string,
    deviceId: string,
    config?: RequestConfig
  ): Observable<Device> {
    console.log("28");
    return this.http.post<Device>(
      `/api/edge/${edgeId}/device/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public unassignDeviceFromEdge(
    edgeId: string,
    deviceId: string,
    config?: RequestConfig
  ) {
    console.log("29");
    return this.http.delete(
      `/api/edge/${edgeId}/device/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getEdgeDevices(
    edgeId: string,
    pageLink: PageLink,
    type: string = "",
    config?: RequestConfig
  ): Observable<PageData<DeviceInfo>> {
    console.log("30");
    return this.http.get<PageData<DeviceInfo>>(
      `/api/edge/${edgeId}/devices${pageLink.toQuery()}&type=${type}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public bulkImportDevices(
    entitiesData: BulkImportRequest,
    config?: RequestConfig
  ): Observable<BulkImportResult> {
    console.log("31");
    return this.http.post<BulkImportResult>(
      "/api/device/bulk_import",
      entitiesData,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public getDevicePublishTelemetryCommands(
    deviceId: string,
    config?: RequestConfig
  ): Observable<PublishTelemetryCommand> {
    console.log("32");
    return this.http.get<PublishTelemetryCommand>(
      `/api/device-connectivity/${deviceId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  public downloadGatewayDockerComposeFile(deviceId: string): Observable<any> {
    console.log("33");
    return this.resourcesService.downloadResource(
      `/api/device-connectivity/gateway-launch/${deviceId}/docker-compose/download`
    );
  }
}
