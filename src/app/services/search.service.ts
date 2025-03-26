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

  async searchByQuery(query: string) {
    const queryParams = {
      text: query
    };
    try {
      this.loadingService.addToFetchList(Constants.dataIds.SEARCH_RESULTS);
      const res: any[] = (await lastValueFrom(this.apiService.post(`search`, queryParams)))['data']['hits'];
      
      this.dataService.setItemValue(Constants.dataIds.SEARCH_RESULTS, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.SEARCH_RESULTS);
    } catch (error) {
      this.loggerService.error(error);
    }
  }
}
