import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingInfo } from '../../models/booking-info.model';

/**
 * QR Code Print View Component
 * 
 * Displays a QR code with booking information in a print-friendly format.
 * This component is designed to be rendered in a popup window and includes
 * print-optimized styles for clear QR code reproduction.
 * 
 * @component
 * @standalone
 * 
 * @remarks
 * This component is lazy-loaded by the QrPrintService to reduce initial bundle size.
 * It is dynamically created and destroyed for each print operation.
 * 
 * Features:
 * - Print-optimized layout with clear QR code display
 * - Responsive design for various screen sizes
 * - High-contrast mode support for accessibility
 * - Automatic HTML escaping of all text content
 * 
 * @example
 * ```typescript
 * // Typically used via QrPrintService, not instantiated directly
 * const componentRef = createComponent(QrPrintViewComponent, {...});
 * componentRef.instance.qrCodeDataUrl = 'data:image/png;base64,...';
 * componentRef.instance.bookingInfo = {
 *   bookingNumber: 'BOOK-123',
 *   areaName: 'Mountain Park',
 *   arrivalDate: '2024-01-15',
 *   departureDate: '2024-01-17'
 * };
 * ```
 * 
 * @see {@link QrPrintService} - Service that uses this component
 * @see {@link BookingInfo} - Interface for booking information
 */
@Component({
  selector: 'app-qr-print-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-print-view.component.html',
  styleUrl: './qr-print-view.component.scss'
})
export class QrPrintViewComponent {
  /**
   * QR code image as a data URL
   * 
   * Should be a PNG image encoded as base64 data URI.
   * This is validated by QrPrintService before being set.
   * 
   * @example
   * ```typescript
   * component.qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...';
   * ```
   */
  @Input() qrCodeDataUrl: string = '';

  /**
   * Booking information to display alongside the QR code
   * 
   * All fields are sanitized by QrPrintService before being set to prevent XSS.
   * Can be null if booking information is not available.
   * 
   * @example
   * ```typescript
   * component.bookingInfo = {
   *   bookingNumber: 'BOOK-123',
   *   areaName: 'Garibaldi Provincial Park',
   *   arrivalDate: '2024-06-15',
   *   departureDate: '2024-06-17'
   * };
   * ```
   */
  @Input() bookingInfo: BookingInfo | null = null;
}

