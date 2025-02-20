import { Injectable } from '@angular/core';
import { LoadingService } from './loading.service';
import { DataService } from './data.service';
import { lastValueFrom } from 'rxjs';
import { Constants } from '../constants';
import { LoggerService } from './logger.service';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class PermitService {

  constructor(private loadingService: LoadingService, private dataService: DataService, private loggerService: LoggerService, private apiService: ApiService) { }

  async getPermit(orcs: string, permitType: string, identifier: string) {
    try {
      if (!orcs || !permitType || !identifier) throw new Error('Missing params');

      this.loadingService.addToFetchList(Constants.dataIds.PERMIT_DETAILS_RESULT);
      const res: any = await lastValueFrom(this.apiService.get(`permits/${orcs}/${permitType}/${identifier}`));
      this.dataService.setItemValue(Constants.dataIds.PERMIT_DETAILS_RESULT, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.PERMIT_DETAILS_RESULT);
    } catch (error) {
      this.loggerService.error(error);
    }
  }
}
