import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { BookingInfo } from '../shared/models/booking-info.model';
import type { QrPrintViewComponent } from '../shared/components/qr-print-view/qr-print-view.component';

/**
 * Service for printing QR codes with booking information
 * Uses Angular components and templates instead of inline HTML strings
 * 
 * The print component is lazy-loaded to reduce initial bundle size
 */
@Injectable({
  providedIn: 'root'
})
export class QrPrintService {

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) { }

  /**
   * Print a QR code with booking information using Angular component
   * 
   * This method lazy-loads the QR print component to reduce initial bundle size.
   * The component is only loaded when the user first attempts to print.
   * 
   * @param qrCodeDataUrl - Base64 data URL of the QR code image (must be PNG format)
   * @param bookingInfo - Booking information to display
   * @throws Error if component rendering or print operation fails
   * 
   * @example
   * ```typescript
   * try {
   *   this.qrPrintService.printQRCode(qrCodeDataUrl, {
   *     bookingNumber: 'BOOK-123',
   *     areaName: 'Mountain Park',
   *     arrivalDate: '2024-01-15'
   *   });
   * } catch (error) {
   *   console.error('Print failed:', error);
   * }
   * ```
   */
  async printQRCode(qrCodeDataUrl: string, bookingInfo: BookingInfo): Promise<void> {
    if (!qrCodeDataUrl) {
      console.warn('No QR code available to print');
      return;
    }

    // Security: Validate that qrCodeDataUrl is a safe PNG data URI
    if (!this.isValidQRCodeDataUrl(qrCodeDataUrl)) {
      console.error('Invalid or potentially unsafe QR code data URL');
      return;
    }

    // Security: Sanitize all booking info fields
    const sanitizedBookingInfo: BookingInfo = {
      bookingNumber: this.sanitize(bookingInfo.bookingNumber),
      areaName: this.sanitize(bookingInfo.areaName),
      arrivalDate: this.sanitize(bookingInfo.arrivalDate)
    };

    let componentRef: ComponentRef<QrPrintViewComponent> | null = null;

    try {
      // Lazy-load the component to reduce initial bundle size
      const { QrPrintViewComponent } = await import('../shared/components/qr-print-view/qr-print-view.component');

      // Create component instance
      componentRef = createComponent(QrPrintViewComponent, {
        environmentInjector: this.injector
      });

      // Set component inputs with sanitized data
      componentRef.instance.qrCodeDataUrl = qrCodeDataUrl;
      componentRef.instance.bookingInfo = sanitizedBookingInfo;

      // Attach to application
      this.appRef.attachView(componentRef.hostView);

      // Trigger change detection
      componentRef.changeDetectorRef.detectChanges();

      // Get the rendered HTML
      const componentElement = (componentRef.hostView as any).rootNodes[0] as HTMLElement;
      const htmlContent = this.wrapComponentHTML(componentElement.outerHTML, sanitizedBookingInfo.bookingNumber);

      // Open print window
      this.openPrintWindow(htmlContent);
    } catch (error) {
      console.error('Failed to render or print QR code:', error);
      // Re-throw to allow caller to handle if needed
      throw new Error('QR code print operation failed. Please try again.');
    } finally {
      // Always clean up the component to prevent memory leaks
      this.cleanupComponent(componentRef);
    }
  }

  /**
   * Wrap the component HTML with necessary document structure for printing
   * 
   * Creates a complete HTML document with proper DOCTYPE, charset, and viewport settings.
   * The component HTML is already sanitized by Angular's template engine, so all
   * interpolated values are automatically escaped.
   * 
   * @param componentHTML - Rendered component HTML (already sanitized by Angular)
   * @param bookingNumber - Sanitized booking number for the document title
   * @returns Complete HTML document string ready for printing
   * 
   * @private
   * @see {@link https://angular.io/guide/security#xss Angular Security Guide}
   */
  private wrapComponentHTML(componentHTML: string, bookingNumber: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking QR Code - ${bookingNumber}</title>
      </head>
      ${componentHTML}
      </html>
    `;
  }

  /**
   * Open a new browser window with print content and trigger print dialog
   * 
   * Opens a popup window with the specified dimensions, writes the HTML content,
   * and automatically triggers the browser's print dialog after images load.
   * 
   * @param htmlContent - Complete HTML document to display in print window
   * 
   * @private
   * @throws Logs error to console if popup is blocked or window creation fails
   * 
   * @remarks
   * - Waits 250ms after images load before triggering print to ensure proper rendering
   * - Users may need to allow popups in their browser settings
   * - Window dimensions are optimized for QR code display (800x600)
   */
  private openPrintWindow(htmlContent: string): void {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for images to load before printing
      printWindow.addEventListener('load', () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      });
    } else {
      console.error('Failed to open print window. Please check your browser popup settings.');
    }
  }

  /**
   * Sanitize a string to prevent XSS attacks
   * 
   * Uses DOM API to safely escape HTML entities. This converts potentially dangerous
   * characters like `<`, `>`, `&` into their HTML entity equivalents.
   * 
   * @param str - String to sanitize (may contain user input)
   * @returns Sanitized string with HTML entities escaped
   * 
   * @private
   * 
   * @example
   * ```typescript
   * sanitize('<script>alert("xss")</script>')
   * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
   * 
   * sanitize('Normal Text')
   * // Returns: 'Normal Text'
   * ```
   * 
   * @see {@link https://owasp.org/www-community/attacks/xss/ OWASP XSS Guide}
   */
  private sanitize(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Validate that a QR code data URL is safe and properly formatted
   * 
   * Performs comprehensive validation to ensure the data URL:
   * - Is a data URI (not an external URL)
   * - Contains only PNG image data
   * - Has valid base64 encoding
   * - Does not exceed size limits
   * 
   * @param dataUrl - Data URL to validate
   * @returns `true` if the data URL is safe and valid, `false` otherwise
   * 
   * @private
   * 
   * @remarks
   * Security checks performed:
   * 1. Must start with 'data:image/png;base64,'
   * 2. Base64 portion contains only valid characters (A-Z, a-z, 0-9, +, /, =)
   * 3. Size limit of 140KB base64 (~100KB decoded image)
   * 
   * @example
   * ```typescript
   * isValidQRCodeDataUrl('data:image/png;base64,iVBORw0KG...')  // true
   * isValidQRCodeDataUrl('data:image/jpeg;base64,...')          // false - not PNG
   * isValidQRCodeDataUrl('https://evil.com/script.js')          // false - not data URI
   * isValidQRCodeDataUrl('data:image/png;base64,<script>')      // false - invalid base64
   * ```
   * 
   * @see {@link /docs/qr-print-security.md QR Print Security Documentation}
   */
  private isValidQRCodeDataUrl(dataUrl: string): boolean {
    // Must be a data URI
    if (!dataUrl.startsWith('data:')) {
      return false;
    }

    // Only allow PNG images
    if (!dataUrl.startsWith('data:image/png;base64,')) {
      return false;
    }

    // Extract the base64 part
    const base64Part = dataUrl.substring('data:image/png;base64,'.length);

    // Validate base64 characters (A-Z, a-z, 0-9, +, /, =)
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    if (!base64Regex.test(base64Part)) {
      return false;
    }

    // Check for reasonable length (QR codes shouldn't be huge)
    // A typical QR code is 10-50KB, so let's allow up to 100KB base64 (~133KB decoded)
    if (base64Part.length > 140000) {
      console.warn('QR code data URL exceeds maximum allowed size');
      return false;
    }

    return true;
  }

  /**
   * Clean up component reference to prevent memory leaks
   * 
   * Safely detaches the component from the application and destroys it.
   * Handles errors gracefully to ensure cleanup always completes.
   * 
   * @param componentRef - Component reference to clean up (may be null)
   * 
   * @private
   * 
   * @remarks
   * This method is called in a `finally` block to guarantee execution even if
   * component rendering fails. It performs two operations:
   * 1. Detach the view from Angular's change detection
   * 2. Destroy the component and free its resources
   * 
   * Both operations are wrapped in try-catch to handle edge cases where the
   * component may already be destroyed or in an invalid state.
   * 
   * @example
   * ```typescript
   * let componentRef = null;
   * try {
   *   componentRef = createComponent(MyComponent, {...});
   *   // ... use component
   * } finally {
   *   this.cleanupComponent(componentRef); // Always cleanup
   * }
   * ```
   */
  private cleanupComponent(componentRef: ComponentRef<QrPrintViewComponent> | null): void {
    if (!componentRef) {
      return;
    }

    try {
      // Detach view from application
      if (componentRef.hostView && !componentRef.hostView.destroyed) {
        this.appRef.detachView(componentRef.hostView);
      }
    } catch (error) {
      console.warn('Error detaching component view:', error);
    }

    try {
      // Destroy the component
      if (!componentRef.hostView?.destroyed) {
        componentRef.destroy();
      }
    } catch (error) {
      console.warn('Error destroying component:', error);
    }
  }
}
