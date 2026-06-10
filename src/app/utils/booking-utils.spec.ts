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
