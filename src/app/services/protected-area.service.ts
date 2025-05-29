import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { LoggerService } from './logger.service';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';
import { lastValueFrom } from 'rxjs';
import { FacilityService } from './facility.service';

@Injectable({
  providedIn: 'root'
})
export class ProtectedAreaService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private facilityService: FacilityService,
    private loadingService: LoadingService
  ) { }

  async getProtectedArea(orcs: string, getFacilities = false) {

    try {
      this.loadingService.addToFetchList('protectedAreaDetails');
      const res = (await lastValueFrom(this.apiService.get(`protected-areas/${orcs}`)))['data'];
      this.dataService.setItemValue('protectedAreaDetails', res);
      this.loadingService.removeFromFetchList('protectedAreaDetails');
      if (getFacilities) {
        this.facilityService.getFacility(`bcparks_${orcs}`);
      }
    } catch (error) {
      this.loggerService.error(error);
    }
  }
}
