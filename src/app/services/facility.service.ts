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
export class FacilityService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService,
    private toastService: ToastService
  ) { }

  async getFacility(collectionId: string, facilityType?: string, facilityId?: string, getActivities = false, getGeozones = false) {
    const queryParams = {};
    if (facilityType) {
      queryParams['facilityType'] = facilityType;
    }
    if (facilityId) {
      queryParams['facilityId'] = facilityId;
    }
    if (getActivities) {
      queryParams['fetchActivities'] = true;
    }
    if (getGeozones) {
      queryParams['fetchGeozones'] = true;
    }

    try {
      this.loadingService.addToFetchList(Constants.dataIds.FACILITY_DETAILS_RESULT);
      const res = (await lastValueFrom(this.apiService.get(`facilities/${collectionId}`, queryParams)))['data'];
      this.dataService.setItemValue(Constants.dataIds.FACILITY_DETAILS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.FACILITY_DETAILS_RESULT);
      return res;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.FACILITY_DETAILS_RESULT);
      this.loggerService.error(error);
      const errorMessage = 
        (error as any)?.error?.msg ||
        (error as any)?.error?.error ||
        (error as any)?.error?.Message ||
        (error as any)?.message ||
        'Unknown error';
      this.toastService.addMessage(
        errorMessage,
        `Facility failed to get`,
        ToastTypes.ERROR
      );
      return null;
    }
    
  }

  async getAccessPoints(collectionId) {
    const accessPointTypes = ['accessPoint', 'trailhead', 'parkingLot'];
    try {
      let accessPoints = [];
      this.loadingService.addToFetchList(Constants.dataIds.ACTIVITY_ACCESS_POINTS);
      for (const type of accessPointTypes) {
        const res = await this.getFacility(collectionId, type);
        if (res && res.items) {
          accessPoints = accessPoints.concat(res.items);
        }
      }
      console.log('accessPoints:', accessPoints);
      this.dataService.setItemValue(Constants.dataIds.ACTIVITY_ACCESS_POINTS, accessPoints);
      this.loadingService.removeFromFetchList(Constants.dataIds.ACTIVITY_ACCESS_POINTS);
      return accessPoints;
    } catch (error) {
      this.loadingService.removeFromFetchList(Constants.dataIds.ACTIVITY_ACCESS_POINTS);
      this.loggerService.error(error);
      const errorMessage = 
        (error as any)?.error?.msg ||
        (error as any)?.error?.error ||
        (error as any)?.error?.Message ||
        (error as any)?.message ||
        'Unknown error';
      this.toastService.addMessage(
        errorMessage,
        `Facility failed to get`,
        ToastTypes.ERROR
      );
      return null;
    }
  }
}
