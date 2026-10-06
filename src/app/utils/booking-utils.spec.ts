import { DateTime } from 'luxon';
import { BookingUtils } from './booking-utils';

const TZ = 'America/Vancouver';
const iso = (days: number) => DateTime.now().setZone(TZ).plus({ days }).toISODate();

describe('BookingUtils.isExpired (#538)', () => {
  it('is false for a same-day pass (still usable)', () => {
    expect(BookingUtils.isExpired({ endDate: iso(0) })).toBe(false);
  });

  it('is true for past passes', () => {
    expect(BookingUtils.isExpired({ endDate: iso(-1) })).toBe(true);
    expect(BookingUtils.isExpired({ endDate: iso(-30) })).toBe(true);
  });

  it('is false for future passes', () => {
    expect(BookingUtils.isExpired({ endDate: iso(1) })).toBe(false);
  });

  it('falls back to startDate when endDate is missing', () => {
    expect(BookingUtils.isExpired({ startDate: iso(-2) })).toBe(true);
    expect(BookingUtils.isExpired({ startDate: iso(2) })).toBe(false);
  });

  it('fails open (not expired) for missing or invalid dates', () => {
    expect(BookingUtils.isExpired({})).toBe(false);
    expect(BookingUtils.isExpired(null)).toBe(false);
    expect(BookingUtils.isExpired({ endDate: 'garbage' })).toBe(false);
  });
});

describe('BookingUtils.formatParkTime', () => {
  const pacific = (hour: number, minute = 0) =>
    DateTime.fromObject({ year: 2026, month: 7, day: 15, hour, minute }, { zone: TZ }).toMillis();

  it('formats a time on the hour', () => {
    expect(BookingUtils.formatParkTime(pacific(7))).toBe('7 am');
    expect(BookingUtils.formatParkTime(pacific(13))).toBe('1 pm');
  });

  it('includes minutes off the hour', () => {
    expect(BookingUtils.formatParkTime(pacific(13, 30))).toBe('1:30 pm');
  });

  it('formats noon as 12 pm', () => {
    expect(BookingUtils.formatParkTime(pacific(12))).toBe('12 pm');
  });

  it('returns null for missing or invalid input', () => {
    expect(BookingUtils.formatParkTime(null)).toBeNull();
    expect(BookingUtils.formatParkTime(undefined)).toBeNull();
    expect(BookingUtils.formatParkTime(NaN)).toBeNull();
    expect(BookingUtils.formatParkTime('1784120400000' as any)).toBeNull();
  });

  it('formats in Pacific time whatever the local zone', () => {
    // 14:00 UTC on a summer day is 7 am PDT.
    expect(BookingUtils.formatParkTime(Date.UTC(2026, 6, 15, 14, 0))).toBe('7 am');
  });
});

describe('BookingUtils arrival and departure times', () => {
  it('formats epoch anchors in Pacific time with minutes', () => {
    // 2026-07-15 14:00 UTC = 7 am Pacific; 20:30 UTC = 1:30 pm Pacific.
    const booking = { checkInAnchor: Date.UTC(2026, 6, 15, 14, 0), checkOutAnchor: Date.UTC(2026, 6, 15, 20, 30) };

    expect(BookingUtils.getArrivalTime(booking)).toBe('7 am');
    expect(BookingUtils.getDepartureTime(booking)).toBe('1:30 pm');
  });

  it('keeps a plain clock-time string as written', () => {
    expect(BookingUtils.getArrivalTime({ reservationContext: { checkInTime: '13:00' } })).toBe('1 pm');
  });
});
