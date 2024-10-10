import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { defaultHttpOptionsFromConfig, RequestConfig } from "./http-utils"; // Import utility functions if available
import { Order } from "@app/modules/home/components/predictive-maintenance/components/forecast/forcast-page.component";
import { PageData, PageLink } from "@app/shared/public-api";
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
