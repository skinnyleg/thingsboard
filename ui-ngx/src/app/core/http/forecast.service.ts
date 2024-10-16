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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { defaultHttpOptionsFromConfig, RequestConfig } from './http-utils'; // Import utility functions if available
import { PageData, PageLink } from '@app/shared/public-api';
import { Order } from '@app/modules/home/models/predictive-maintenance.models';
// import { Order } from '../components/forecast/forcast-page.component'; // Adjust import path as needed

@Injectable({
  providedIn: "root",
})
export class ForecastService {
  private baseUrl = "/api/forecasts"; // Base URL for your API

  constructor(private http: HttpClient) {}

  // Fetch forecasts with pagination (PageLink handling like in DeviceService)
  getForecastsByPage(
    pageLink: PageLink,
    config?: RequestConfig
  ): Observable<PageData<Order>> {
    return this.http.get<PageData<Order>>(
      `${this.baseUrl}${pageLink.toQuery()}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  // Fetch a specific forecast by its ID
  getForecast(forecastId: string, config?: RequestConfig): Observable<Order> {
    return this.http.get<Order>(
      `${this.baseUrl}/${forecastId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }

  // Save a new forecast
  addForecast(forecast: any, config?: RequestConfig): Observable<Order> {
    return this.http.post<Order>(
      `${this.baseUrl}`,
      forecast,
      defaultHttpOptionsFromConfig(config)
    );
  }

  // Update an existing forecast
  updateForecast(forecast: any, config?: RequestConfig): Observable<Order> {
    return this.http.put<Order>(
      `${this.baseUrl}/${forecast.id}`,
      forecast,
      defaultHttpOptionsFromConfig(config)
    );
  }

  // Delete a forecast by its ID
  deleteForecast(forecastId: string, config?: RequestConfig): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${forecastId}`,
      defaultHttpOptionsFromConfig(config)
    );
  }
}
