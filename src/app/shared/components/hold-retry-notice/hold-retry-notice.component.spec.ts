import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DateTime } from 'luxon';

import { HoldRetryNoticeComponent, formatCountdown, holdRetryMessage } from './hold-retry-notice.component';

describe('holdRetryMessage', () => {
  const now = DateTime.fromISO('2026-10-02T13:00:00Z');

  it('names the morning time in Pacific time', () => {
    expect(holdRetryMessage(DateTime.fromISO('2026-10-02T14:15:00Z'), now))
      .toBe("You've changed this booking several times. You can try again at 7:15 a.m. Pacific time.");
  });

  it('names an afternoon time', () => {
    expect(holdRetryMessage(DateTime.fromISO('2026-10-02T20:05:00Z'), now)).toContain('at 1:05 p.m. Pacific time.');
  });

  it('adds the date when the time falls on another day', () => {
    expect(holdRetryMessage(DateTime.fromISO('2026-10-03T15:00:00Z'), now))
      .toContain('at 8:00 a.m. Pacific time on October 3.');
  });
});

describe('formatCountdown', () => {
  it('shows minutes and seconds, rounding up', () => {
    expect(formatCountdown(299_500)).toBe('5:00');
    expect(formatCountdown(61_000)).toBe('1:01');
    expect(formatCountdown(1)).toBe('0:01');
  });

  it('shows hours once past an hour', () => {
    expect(formatCountdown(3_723_000)).toBe('1:02:03');
  });
});

describe('HoldRetryNoticeComponent', () => {
  let fixture: ComponentFixture<HoldRetryNoticeComponent>;
  let el: HTMLElement;

  const liveRegion = () => el.querySelector('[aria-live="polite"]') as HTMLElement;
  const countdown = () => el.querySelector('[aria-hidden="true"] strong')?.textContent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HoldRetryNoticeComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('keeps an empty live region in place before any retry time is set', () => {
    expect(liveRegion()).not.toBeNull();
    expect(liveRegion().textContent?.trim()).toBe('');
    expect(el.querySelector('.alert')).toBeNull();
  });

  it('sets the live message once and ticks the countdown outside it', fakeAsync(() => {
    fixture.componentRef.setInput('retryAt', DateTime.now().plus({ minutes: 5 }));
    fixture.detectChanges();
    const message = liveRegion().textContent?.trim();

    expect(message).toContain('You can try again at');
    expect(countdown()).toBe('5:00');

    tick(1000);
    fixture.detectChanges();

    expect(countdown()).toBe('4:59');
    expect(liveRegion().textContent?.trim()).toBe(message);

    fixture.destroy();
  }));

  it('clears itself and reports when the retry time passes', fakeAsync(() => {
    const elapsed = jasmine.createSpy('elapsed');
    fixture.componentInstance.elapsed.subscribe(elapsed);
    fixture.componentRef.setInput('retryAt', DateTime.now().plus({ seconds: 2 }));
    fixture.detectChanges();

    tick(2000);
    fixture.detectChanges();

    expect(elapsed).toHaveBeenCalledTimes(1);
    expect(liveRegion().textContent?.trim()).toBe('');
    expect(el.querySelector('.alert')).toBeNull();
  }));
});
