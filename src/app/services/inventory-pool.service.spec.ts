import { TestBed } from '@angular/core/testing';
import { InventoryPoolService } from './inventory-pool.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { LoadingService } from './loading.service';
import { of, throwError } from 'rxjs';

describe('InventoryPoolService', () => {
  let service: InventoryPoolService;
  let apiService: jasmine.SpyObj<ApiService>;
  let loggerService: jasmine.SpyObj<LoggerService>;
  let loadingService: jasmine.SpyObj<LoadingService>;

  beforeEach(() => {
    const apiSpy = jasmine.createSpyObj('ApiService', ['get']);
    const loggerSpy = jasmine.createSpyObj('LoggerService', ['error']);
    const loadingSpy = jasmine.createSpyObj('LoadingService', ['addToFetchList', 'removeFromFetchList']);

    TestBed.configureTestingModule({
      providers: [
        InventoryPoolService,
        { provide: ApiService, useValue: apiSpy },
        { provide: LoggerService, useValue: loggerSpy },
        { provide: LoadingService, useValue: loadingSpy }
      ]
    });

    service = TestBed.inject(InventoryPoolService);
    apiService = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
    loggerService = TestBed.inject(LoggerService) as jasmine.SpyObj<LoggerService>;
    loadingService = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getInventoryPool', () => {
    it('returns inventory pool data on successful request', async () => {
      const mockData = { isOpen: true, available: 5 };
      apiService.get.and.returnValue(of({ data: mockData }));

      const result = await service.getInventoryPool('c1', 'dayuse', 'a1', 'p1', '2026-11-26');

      expect(result).toEqual(mockData);
      expect(loadingService.addToFetchList).toHaveBeenCalled();
      expect(loadingService.removeFromFetchList).toHaveBeenCalled();
    });

    it('returns data directly when API response has no "data" wrapper', async () => {
      const mockData = { isOpen: false, available: null };
      apiService.get.and.returnValue(of(mockData));

      const result = await service.getInventoryPool('c1', 'dayuse', 'a1', 'p1', '2026-11-26');

      expect(result).toEqual(mockData);
    });

    it('returns { failed: true, available: null } when request fails', async () => {
      apiService.get.and.returnValue(throwError(() => new Error('Network error')));

      const result = await service.getInventoryPool('c1', 'dayuse', 'a1', 'p1', '2026-11-26');

      expect(result).toEqual({ failed: true, available: null });
      expect(loggerService.error).toHaveBeenCalledWith(jasmine.stringContaining('Failed to fetch inventory pool'));
      expect(loadingService.removeFromFetchList).toHaveBeenCalled();
    });

    it('logs error details when request fails', async () => {
      const error = new Error('Network offline');
      apiService.get.and.returnValue(throwError(() => error));

      await service.getInventoryPool('c1', 'dayuse', 'a1', 'p1', '2026-11-26');

      expect(loggerService.error).toHaveBeenCalledWith(error);
    });

    it('removes loading indicator even on failure', async () => {
      apiService.get.and.returnValue(throwError(() => new Error('API error')));

      await service.getInventoryPool('c1', 'dayuse', 'a1', 'p1', '2026-11-26');

      expect(loadingService.removeFromFetchList).toHaveBeenCalled();
    });
  });
});
