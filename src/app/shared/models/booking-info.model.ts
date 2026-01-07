/**
 * Booking Information Interface
 * 
 * Represents the essential booking details displayed on printed QR codes.
 * All fields should be sanitized before being passed to components to prevent XSS.
 * 
 * @interface
 * 
 * @example
 * ```typescript
 * const bookingInfo: BookingInfo = {
 *   bookingNumber: 'BOOK-2024-001',
 *   areaName: 'Garibaldi Provincial Park',
 *   arrivalDate: '2024-06-15',
 *   departureDate: '2024-06-17'
 * };
 * ```
 * 
 * @see {@link QrPrintService} - Service that uses this interface
 * @see {@link QrPrintViewComponent} - Component that displays this information
 */
export interface BookingInfo {
  /**
   * Unique booking identifier
   * 
   * @example 'BOOK-2024-001'
   * @remarks Should be sanitized to prevent XSS before display
   */
  bookingNumber: string;

  /**
   * Name of the park or camping area
   * 
   * @example 'Garibaldi Provincial Park'
   * @remarks Should be sanitized to prevent XSS before display
   */
  areaName: string;

  /**
   * Booking arrival/check-in date
   * 
   * @example '2024-06-15'
   * @remarks Typically in YYYY-MM-DD format but can be any string format
   */
  arrivalDate: string;

  /**
   * Booking departure/check-out date
   * 
   * @example '2024-06-17'
   * @remarks Typically in YYYY-MM-DD format but can be any string format
   */
  departureDate: string;
}

