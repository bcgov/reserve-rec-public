import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { Constants } from '../constants';
import { lastValueFrom } from 'rxjs';
import { LoggerService } from './logger.service';
import { ApiService } from './api.service';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  constructor(
    private dataService: DataService,
    private loggerService: LoggerService,
    private apiService: ApiService,
    private loadingService: LoadingService
  ) { }


  async fetchAll() {
    const queryParams = {
      text: 'all',
    };
    try {
      const res: any[] = (await lastValueFrom(this.apiService.get(`search`, queryParams)))['data']['hits'];
      this.dataService.setItemValue(Constants.dataIds.ALL, res);
    } catch (error) {
      this.loggerService.error(error);
    }
  }

  async getFacilities(query: string) {
    const queryParams = {
      text: query,
      schema: 'facility',
    };
    try {
      this.loadingService.addToFetchList(Constants.dataIds.SEARCH_RESULTS);
      const res: any[] = (await lastValueFrom(this.apiService.get(`search`, queryParams)))['data']['hits'];
      // const permitArray = [];
      // // UI: group up AM, PM, DAY passes as one entry 
      // const dayUsePermits = res.filter((item) => {
      //   if (item._source.permitType === 'dayuse') {
      //     return true;
      //   }
      //   permitArray.push(item);
      //   return false;
      // });
      // const groupedDayUsePermits = this.consolidateDayUse(dayUsePermits);
      // permitArray.push(...groupedDayUsePermits);

      // this.dataService.setItemValue(Constants.dataIds.SEARCH_RESULTS, permitArray);
      this.dataService.setItemValue(Constants.dataIds.SEARCH_RESULTS, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.SEARCH_RESULTS);
    } catch (error) {
      this.loggerService.error(error);
    }
  }

  // consolidateDayUse(dayUsePermits) {
  //   const groupedDayUsePermits = Object.values(dayUsePermits.reduce((acc, item) => {
  //     const parentSk = item._source.parent.sk;
  //     if (!acc[parentSk]) {
  //       // This will cause the first DUP permit to be the one that shows up in the list in the UI
  //       acc[parentSk] = { parentSk, groupedDayUsePermits: [], _source: item._source };

  //       // Update the displayName
  //       acc[parentSk]._source.displayName = item._source.displayName.replace(/(AM|PM|DAY)/, '');
  //     }
  //     acc[parentSk].groupedDayUsePermits.push(item);
  //     return acc;
  //   }, {}));
  //   return groupedDayUsePermits
  // }
}
