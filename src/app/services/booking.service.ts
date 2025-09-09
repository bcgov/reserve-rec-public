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
      this.loadingService.removeFromFetchList(Constants.dataIds.MY_BOOKINGS_RESULT);
      this.loggerService.error(error);
    }
  }

  async createBooking(bookingData, collectionId: string, activityType: string, activityId: string, startDate: string) {
    const queryParams = {
      collectionId: collectionId,
      activityType: activityType,
      activityId: activityId,
      startDate: startDate,
    };
    try {
      this.dataService.clearItemValue(Constants.dataIds.CREATE_BOOKING_RESULT);
      this.loadingService.addToFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      const res = (await lastValueFrom(this.apiService.post(`bookings`, bookingData, queryParams)))['data'];
      this.dataService.setItemValue(Constants.dataIds.CREATE_BOOKING_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      this.loggerService.error(error);
      throw error; // Re-throw the error for further handling if needed
    }
  }

  async getBookingByGlobalId(globalId: string, fetchAccessPoints = false) {
    const queryParams = {
      fetchAccessPoints: fetchAccessPoints
    };
    try {
      this.dataService.clearItemValue(Constants.dataIds.BOOKING_DETAILS_RESULT);
      this.loadingService.addToFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      const res = await lastValueFrom(this.apiService.get(`bookings/${globalId}`, queryParams));
      this.dataService.setItemValue(Constants.dataIds.BOOKING_DETAILS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      this.loggerService.error(error);
      throw error; // Re-throw the error for further handling if needed
    }
  }
}
