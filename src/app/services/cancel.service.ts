import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { Constants } from '../constants';
import { ApiService } from './api.service';
import { DataService } from './data.service';
import { LoadingService } from './loading.service';
import { LoggerService } from './logger.service';
import { ToastService, ToastTypes } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class CancelService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService,
    private toastService: ToastService
  ) { }
  
  async cancelBooking(bookingId: string, data: any) {
    try {
      this.loadingService.addToFetchList(Constants.dataIds.BOOKING_DETAILS_POST_RESULT);
      const res = (await lastValueFrom(this.apiService.post(`bookings/${bookingId}/cancel`, data)))['data'];
      this.toastService.addMessage(
        `Successfully cancelled booking`,
        '',
        ToastTypes.SUCCESS
      );
      this.dataService.setItemValue(Constants.dataIds.BOOKING_DETAILS_POST_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_POST_RESULT);
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_POST_RESULT);
      this.loggerService.error(error);
      const errorMessage = 
        (error as any)?.error?.msg ||
        (error as any)?.error?.error ||
        (error as any)?.error?.Message ||
        (error as any)?.message ||
        'Unknown error';
      // log error to console
      console.error('Error cancelling booking: ', errorMessage);
      this.toastService.addMessage(
        '', // Hide the error from the frontend
        `Error cancelling booking: ${errorMessage}`,
        ToastTypes.ERROR
      );
    }
  }
}
