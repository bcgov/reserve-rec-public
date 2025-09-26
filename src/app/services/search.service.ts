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
      console.log("🔍 Starting search for query:", query);
      console.log("📤 Query params:", queryParams);
      
      this.loadingService.addToFetchList(Constants.dataIds.SEARCH_RESULTS);
      
      console.log("🌐 Making API call to search endpoint...");
      const response: any = await lastValueFrom(this.apiService.post(`search`, queryParams));
      
      console.log("📥 Raw API response:", response);
      console.log("📊 Response structure:", {
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : 'no data',
        hasHits: !!response?.data?.hits,
        hitsType: response?.data?.hits ? typeof response.data.hits : 'undefined',
        hitsLength: Array.isArray(response?.data?.hits) ? response.data.hits.length : 'not array'
      });
      
      // Safely extract the hits data with fallback to empty array
      const res: any[] = response?.data?.hits || [];
      console.log("✅ Processed search results:", res.length, "items");
      
      this.dataService.setItemValue(Constants.dataIds.SEARCH_RESULTS, res);
      this.loadingService.removeFromFetchList(Constants.dataIds.SEARCH_RESULTS);
    } catch (error) {
      console.error("❌ Search API error:", error);
      console.log("🔍 Error details:", {
        message: (error as any)?.message,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        url: (error as any)?.url
      });
      this.loggerService.error(error);
      // Set empty array on error to prevent undefined issues
      this.dataService.setItemValue(Constants.dataIds.SEARCH_RESULTS, []);
      this.loadingService.removeFromFetchList(Constants.dataIds.SEARCH_RESULTS);
    }
  }
}
