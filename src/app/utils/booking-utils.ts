/**
 * Utility class for booking-related helper methods.
 * Provides consistent data access and formatting across booking components.
 */
import { DateTime } from 'luxon';

export class BookingUtils {
  
  /**
   * Get the geozone/collection display name
   */
  static getGeozoneName(booking: any): string {
    return booking?.geozoneDisplayName || booking?.collectionId || 'Unknown Location';
  }

  /**
   * Get the facility display name
   */
  static getFacilityName(booking: any): string {
    return booking?.facilityDisplayName || booking?.displayName || '';
  }

  /**
   * Get the arrival/start date
   */
  static getArrivalDate(booking: any): string {
    return booking?.startDate || 'N/A';
  }

  /**
   * Get the departure/end date
   */
  static getDepartureDate(booking: any): string {
    return booking?.endDate || 'N/A';
  }

  /**
   * Get booking status in normalized form
   */
  static getStatus(booking: any): string {
    return (booking?.status || booking?.bookingStatus || '').toLowerCase();
  }

  /**
   * Check whether booking is cancelled
   */
  static isCancelled(booking: any): boolean {
    return BookingUtils.getStatus(booking) === 'cancelled';
  }

  /**
   * Get formatted arrival/check-in time
   */
  static getArrivalTime(booking: any): string {
    const checkInAnchor =
      booking?.checkInAnchor ||
      booking?.reservationContext?.checkInAnchor ||
      booking?.reservationContext?.checkInTime;

    return BookingUtils.formatBookingTime(checkInAnchor, booking?.startDate);
  }

  /**
   * Get formatted departure/check-out time
   */
  static getDepartureTime(booking: any): string {
    const checkOutAnchor =
      booking?.checkOutAnchor ||
      booking?.reservationContext?.checkOutAnchor ||
      booking?.reservationContext?.checkOutTime;

    return BookingUtils.formatBookingTime(checkOutAnchor, booking?.endDate);
  }

  /**
   * Get the booking number/ID
   */
  static getBookingNumber(booking: any): string {
    return booking?.bookingId || booking?.globalId || 'N/A';
  }

  /**
   * Get named occupant email
   */
  static getEmail(booking: any): string {
    return booking?.namedOccupant?.contactInfo?.email || 'N/A';
  }

  /**
   * Get the product display name
   */
  static getProductDisplayName(booking: any): string {
    if (booking?.productDisplayName) {
      return booking.productDisplayName;
    }
    // Fallback: parse from displayName if needed
    if (booking?.displayName) {
      const parts = booking.displayName.split(',');
      return parts[0]?.trim() || 'N/A';
    }
    return 'N/A';
  }

  /**
   * Get the booking type (activity type)
   */
  static getBookingType(booking: any): string {
    const activityType = booking?.activityType;
    if (!activityType) {
      return 'Day-use pass';
    }
    return activityType;
  }

  /**
   * Get the pass/booking quantity count
   */
  static getPassCount(booking: any): number {
    if (typeof booking?.quantity === 'number') {
      return booking.quantity;
    }
    return BookingUtils.getPartySize(booking);
  }

  /**
   * Calculate total party size from partyContext or partyInformation
   */
  static getPartySize(booking: any): number {
    const party = booking?.partyContext || booking?.partyInformation;
    if (!party) return 0;
    return (party.adult || 0) + (party.senior || 0) + (party.youth || 0) + (party.child || 0);
  }

  /**
   * Calculate booking length in nights
   */
  static getNights(booking: any): number {
    const startDate = booking?.startDate;
    const endDate = booking?.endDate;

    if (!startDate || !endDate) {
      return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get entry point display text
   */
  static getEntryPoint(booking: any): string {
    if (booking?.entryPoint) {
      if (typeof booking.entryPoint === 'object') {
        return booking.entryPoint.text || booking.entryPoint.sk || 'Not specified';
      }
      return booking.entryPoint;
    }
    return 'Not specified';
  }

  /**
   * Get exit point display text
   */
  static getExitPoint(booking: any): string {
    if (booking?.exitPoint) {
      if (typeof booking.exitPoint === 'object') {
        return booking.exitPoint.text || booking.exitPoint.sk || 'Not specified';
      }
      return booking.exitPoint;
    }
    return 'Not specified';
  }

  /**
   * Get named occupant full name
   */
  static getNamedOccupant(booking: any): string {
    const firstName = booking?.namedOccupant?.firstName || '';
    const lastName = booking?.namedOccupant?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Not provided';
  }

  /**
   * Get first vehicle's license plate
   */
  static getLicensePlate(booking: any): string {
    const firstVehicle = Array.isArray(booking?.vehicleInformation)
      ? booking.vehicleInformation[0]
      : null;
    return firstVehicle?.licensePlate || 'Not provided';
  }

  /**
   * Get first vehicle's registration region
   */
  static getLicensePlateRegistrationRegion(booking: any): string {
    const firstVehicle = Array.isArray(booking?.vehicleInformation)
      ? booking.vehicleInformation[0]
      : null;
    return firstVehicle?.licensePlateRegistrationRegion || '';
  }

  /**
   * Get total number of adult and senior occupants
   */
  static getAdultOccupants(booking: any): number {
    const partyContext = booking?.partyContext || {};
    return parseInt(partyContext.adult || 0) + parseInt(partyContext.senior || 0);
  }

  /**
   * Get total number of youth and child occupants
   */
  static getYouthOccupants(booking: any): number {
    const partyContext = booking?.partyContext || {};
    return parseInt(partyContext.youth || 0) + parseInt(partyContext.child || 0);
  }

  /**
   * Format party context for display
   */
  static formatParty(partyContext: any): string {
    const adultCount = parseInt(partyContext?.adult || 0) + parseInt(partyContext?.senior || 0);
    const youthCount = parseInt(partyContext?.youth || 0) + parseInt(partyContext?.child || 0);
    const total = adultCount + youthCount;
    
    if (adultCount > 0 && youthCount > 0) {
      return `${total} (${adultCount} Adult, ${youthCount} Youth)`;
    } else if (adultCount > 0) {
      return `${adultCount} Adult`;
    } else if (youthCount > 0) {
      return `${youthCount} Youth`;
    }
    return '0';
  }

  private static formatBookingTime(timeValue: unknown, fallbackDate?: string): string {
    const dt = BookingUtils.parseDateTime(timeValue, fallbackDate);
    if (!dt) {
      return '';
    }
    return dt.toFormat('h a').toLowerCase();
  }

  private static parseDateTime(value: unknown, fallbackDate?: string): DateTime | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const fromMillis = DateTime.fromMillis(value);
      return fromMillis.isValid ? fromMillis : null;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const trimmed = value.trim();

      const fromIso = DateTime.fromISO(trimmed);
      if (fromIso.isValid) {
        return fromIso;
      }

      const fromHourMinute = DateTime.fromFormat(trimmed, 'H:mm');
      if (fromHourMinute.isValid) {
        return fromHourMinute;
      }

      const fromHourMinuteAmPm = DateTime.fromFormat(trimmed, 'h:mm a');
      if (fromHourMinuteAmPm.isValid) {
        return fromHourMinuteAmPm;
      }
    }

    if (fallbackDate) {
      const fromFallback = DateTime.fromISO(fallbackDate);
      return fromFallback.isValid ? fromFallback : null;
    }

    return null;
  }
}
