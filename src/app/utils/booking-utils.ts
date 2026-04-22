/**
 * Utility class for booking-related helper methods.
 * Provides consistent data access and formatting across booking components.
 */
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
    return booking?.facilityDisplayName || booking?.displayName || 'N/A';
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
   * Get the booking number/ID
   */
  static getBookingNumber(booking: any): string {
    return booking?.bookingId || booking?.globalId || 'N/A';
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
      return 'Day use';
    }
    if (activityType.toLowerCase() === 'dayuse') {
      return 'Day use';
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
}
