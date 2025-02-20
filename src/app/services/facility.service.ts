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
export class FacilityService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService
  ) { }

  async getFacility(orcs: string, facilityType: string, facilityId: string, fetchActivities = true) {
    const queryParams = {
      orcs: orcs,
      facilityType: facilityType,
      facilityId: facilityId,
    };

    if (fetchActivities) {
      queryParams['fetchActivities'] = true;
    }

    try {
      this.loadingService.addToFetchList(Constants.dataIds.FACILITY_DETAILS_RESULT);
      const res = (await lastValueFrom(this.apiService.get(`facilities`, queryParams)))['data'];
      console.log(res);
      this.dataService.setItemValue(Constants.dataIds.FACILITY_DETAILS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.FACILITY_DETAILS_RESULT);
    } catch (error) {
      this.loggerService.error(error);
    }
  }
}
