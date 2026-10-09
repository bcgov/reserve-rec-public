import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import { Constants } from '../constants';
import { ApiService } from './api.service';
import { DataService } from './data.service';
import { LoadingService } from './loading.service';
import { LoggerService } from './logger.service';
import { ToastService, ToastTypes } from './toast.service';

export interface HoldLimits {
  freeRemovalsLeft: number;
}

const HOLD_RETRY_CODES = ['HOLD_COOLDOWN', 'HOLD_CAP'];

// A 429 from hold creation carries code and retryAt at the body root or under `data`.
export function parseHoldRetryAt(error: any): DateTime | null {
  if (error?.status !== 429) return null;
  const body = error?.error;
  const code = HOLD_RETRY_CODES.find(c => c === body?.code || c === body?.data?.code);
  const retryAt = DateTime.fromISO(String(body?.retryAt ?? body?.data?.retryAt ?? ''), { zone: 'utc' });
  return code && retryAt.isValid ? retryAt : null;
}

function parseHoldLimits(value: any): HoldLimits | undefined {
  const left = value?.freeRemovalsLeft;
  return Number.isInteger(left) ? { freeRemovalsLeft: left } : undefined;
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService,
    private toastService: ToastService
  ) { }

  async getBookings(userSub: string) {
    const queryParams = {
      userId: userSub
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
      productId: bookingData.productId,
      quantity: bookingData.quantity,
    };
    try {
      this.dataService.clearItemValue(Constants.dataIds.CREATE_BOOKING_RESULT);
      this.loadingService.addToFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      const body = await lastValueFrom(this.apiService.post(`bookings`, bookingData, queryParams));
      const res = body?.['data'];
      if (res && typeof res === 'object') {
        res.holdLimits = parseHoldLimits(res.holdLimits ?? body?.['holdLimits']);
      }
      this.dataService.setItemValue(Constants.dataIds.CREATE_BOOKING_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      return res;
    } catch (error: any) {
      this.loadingService.removeFromFetchList(Constants.dataIds.CREATE_BOOKING_RESULT);
      this.loggerService.error(error);
      // Surface waiting room 403 so callers can redirect appropriately
      if (error?.status === 403 && error?.error?.waitingRoom) {
        const wrError: any = new Error('Waiting room required');
        wrError.waitingRoom = true;
        throw wrError;
      }
      throw error;
    }
  }

  async getBookingByGlobalId(globalId: string, fetchAccessPoints = false) {
    const queryParams = {
      fetchAccessPoints: fetchAccessPoints
    };
    try {
      this.dataService.clearItemValue(Constants.dataIds.BOOKING_DETAILS_RESULT);
      this.loadingService.addToFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      const res = (await lastValueFrom(this.apiService.get(`bookings/${globalId}`, queryParams)))['data'];
      this.dataService.setItemValue(Constants.dataIds.BOOKING_DETAILS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.BOOKING_DETAILS_RESULT);
      this.loggerService.error(error);
      throw error; // Re-throw the error for further handling if needed
    }
  }
  
  async completeBooking(bookingId: string, completionData: any) {
    try {
      const res = (await lastValueFrom(this.apiService.post(`bookings/${bookingId}/complete`, completionData, {})))['data'];
      return res;
    } catch (error) {
      this.loggerService.error(error);
      throw error;
    }
  }

  async fetchBooking(bookingId: string) {
    try {
      return (await lastValueFrom(this.apiService.get(`bookings/${bookingId}`)))['data'];
    } catch (error) {
      this.loggerService.error(error);
      return null;
    }
  }

  notifyAlreadyConfirmed() {
    this.toastService.addMessage(
      'This booking is already confirmed. You can manage it from My bookings.',
      'Already confirmed',
      ToastTypes.INFO
    );
  }

  notifyRemoved() {
    this.toastService.addMessage(
      'Item removed from cart',
      'Success',
      ToastTypes.SUCCESS
    );
  }

  // Remove a booking item from the cart
  async removeBooking(bookingId: string, options = { quiet: false}) {
    try {
      const res = (await lastValueFrom(this.apiService.post(`bookings/${bookingId}/remove`, {})))['data'];
      // Swapping bookings in cart, hide the "remove item" from showing - avoid confusion
      if (!options.quiet) this.notifyRemoved();
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.PRODUCT_RESULT);
      this.loggerService.error(error);
      const errorMessage =
        (error as any)?.error?.msg ||
        (error as any)?.error?.error ||
        (error as any)?.error?.Message ||
        (error as any)?.message ||
        'Unknown error';
      if ((error as any)?.status === 409 && (error as any)?.error?.data?.status === 'confirmed') {
        this.notifyAlreadyConfirmed();
        return null;
      }
      // A hold that already timed out, was cancelled (409, or 400 on a lost
      // race) or no longer exists is already gone from the cart - that's the
      // outcome the caller wanted.
      const alreadyGone =
        (error as any)?.error?.data?.refusal === 'not_found' ||
        /status "(TIMED_OUT|cancelled|expired)"|already cancelled/i.test(errorMessage);
      if ([400, 409].includes((error as any)?.status) && alreadyGone) {
        this.notifyRemoved();
        return null;
      }
      // log error to console
      console.error('Error removing item from cart: ', errorMessage);
      return null;
    }
  }

  async cancelBooking(bookingId: string, body: object) {
    try {
      const res = (await lastValueFrom(this.apiService.post(`bookings/${bookingId}/cancel`, body, {})))['data'];
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.PRODUCT_RESULT);
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
        'Error', 
        `Error cancelling booking`,
        ToastTypes.ERROR
      );
      
      return null;
    }
  }
}
