import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root',
})
export class InventoryPoolService {
  constructor(
    private apiService: ApiService,
    private loggerService: LoggerService,
  ) { }

  /**
   * Fetch inventory pool data for a specific product on a given date.
   * Returns only isOpen and available fields.
   */
  async getInventoryPool(collectionId: string, activityType: string, activityId: string, productId: string, date: string) {
    try {
      const result = await lastValueFrom(this.apiService.get(
        `inventoryPools/${collectionId}/${activityType}/${activityId}/${productId}`,
        { date }
      ));
      return (result as any)?.data || result || {};
    } catch (error) {
      this.loggerService.error(`Failed to fetch inventory pool for date ${date}:`);
      this.loggerService.error(error);
      // Fail open with default values - unknown availability treated as unlimited
      return { isOpen: true, available: null };
    }
  }
}
