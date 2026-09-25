import { TestBed } from '@angular/core/testing';

import { ServerTimeService } from './server-time.service';

describe('ServerTimeService', () => {
  let service: ServerTimeService;

  beforeEach(() => {
    service = TestBed.inject(ServerTimeService);
  });

  it('uses the device clock until a response supplies server time', () => {
    expect(Math.abs(service.now().toMillis() - Date.now())).toBeLessThan(50);
  });

  it('corrects for a device clock that runs fast', () => {
    service.record({ serverTime: Date.now() - 5 * 60 * 1000 });

    expect(Math.abs(service.now().toMillis() - (Date.now() - 5 * 60 * 1000))).toBeLessThan(50);
  });

  it('keeps the last offset when a body has no usable serverTime', () => {
    service.record({ serverTime: Date.now() + 60 * 1000 });
    for (const body of [null, undefined, 'text', {}, { serverTime: '123' }, { serverTime: NaN }]) {
      service.record(body);
    }

    expect(Math.abs(service.now().toMillis() - (Date.now() + 60 * 1000))).toBeLessThan(50);
  });
});
