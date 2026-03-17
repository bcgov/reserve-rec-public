import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { DataService } from './data.service';
import { LoadingService } from './loading.service';
import { LoggerService } from './logger.service';
import { ToastService } from './toast.service';
import { Constants } from '../constants';

@Injectable({
  providedIn: 'root',
})
export class ProductDateService {
  constructor(
    private dataService: DataService,
    private toastService: ToastService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService
  ) { }

  async getProductDates(collectionId, activityType, activityId, productId, startDate?, endDate?) {
    const queryParams = {};
    if (startDate) queryParams['startDate'] = startDate;
    if (endDate) queryParams['endDate'] = endDate;

    try {
      this.loadingService.addToFetchList(Constants.dataIds.PRODUCT_DATE_RESULT);
      const res = (await lastValueFrom(this.apiService.get(`product-dates/${collectionId}/${activityType}/${activityId}/${productId}`, queryParams)))['data'];
      this.dataService.setItemValue(Constants.dataIds.PRODUCT_DATE_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.PRODUCT_DATE_RESULT);
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.PRODUCT_DATE_RESULT);
      this.loggerService.error(error);
      return null;
    }
  }
}
