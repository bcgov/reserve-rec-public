import { TestBed } from '@angular/core/testing';

import { ServerTimeService } from './server-time.service';

describe('ServerTimeService', () => {
  let service: ServerTimeService;

  const deviceNow = Date.UTC(2026, 8, 23, 14, 0, 0);

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(deviceNow));
    service = TestBed.inject(ServerTimeService);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('uses the device clock until a response supplies server time', () => {
    expect(service.now().toMillis()).toBe(deviceNow);
  });

  it('corrects for a device clock that runs fast', () => {
    service.record({ serverTime: deviceNow - 5 * 60 * 1000 });

    expect(service.now().toMillis()).toBe(deviceNow - 5 * 60 * 1000);
  });

  it('keeps the offset running as the device clock moves on', () => {
    service.record({ serverTime: deviceNow - 5 * 60 * 1000 });
    jasmine.clock().tick(30 * 1000);

    expect(service.now().toMillis()).toBe(deviceNow - 5 * 60 * 1000 + 30 * 1000);
  });

  it('keeps the last offset when a body has no usable serverTime', () => {
    service.record({ serverTime: deviceNow + 60 * 1000 });
    for (const body of [null, undefined, 'text', {}, { serverTime: '123' }, { serverTime: NaN }]) {
      service.record(body);
    }

    expect(service.now().toMillis()).toBe(deviceNow + 60 * 1000);
  });
});
