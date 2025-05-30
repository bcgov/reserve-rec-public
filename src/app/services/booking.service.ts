import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { Constants } from '../constants';
import { ApiService } from './api.service';
import { DataService } from './data.service';
import { LoadingService } from './loading.service';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class BookingService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService
  ) { }

  async getBookings(userSub: string) {
    const queryParams = {
      user: userSub
    };

    try {
      this.loadingService.addToFetchList(Constants.dataIds.MY_BOOKINGS_RESULT);
      const res = (await lastValueFrom(this.apiService.get(`bookings`, queryParams)))['data'];
      this.dataService.setItemValue(Constants.dataIds.MY_BOOKINGS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.MY_BOOKINGS_RESULT);
    } catch (error) {
      this.loggerService.error(error);
    }
  }
}
