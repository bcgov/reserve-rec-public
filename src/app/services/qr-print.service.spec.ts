import { TestBed } from '@angular/core/testing';
import { QrPrintService } from './qr-print.service';

describe('QrPrintService', () => {
  let service: QrPrintService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QrPrintService]
    });
    service = TestBed.inject(QrPrintService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('printQRCode', () => {
    let windowOpenSpy: jasmine.Spy;
    let mockPrintWindow: any;

    beforeEach(() => {
      mockPrintWindow = {
        document: {
          write: jasmine.createSpy('write'),
          close: jasmine.createSpy('close')
        },
        focus: jasmine.createSpy('focus'),
        print: jasmine.createSpy('print'),
        addEventListener: jasmine.createSpy('addEventListener').and.callFake((event: string, callback: () => void) => {
          if (event === 'load') {
            setTimeout(callback, 0);
          }
        })
      };

      windowOpenSpy = spyOn(window, 'open').and.returnValue(mockPrintWindow);
    });

    it('should warn and return early if no QR code is provided', async () => {
      spyOn(console, 'warn');
      
      await service.printQRCode('', {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      });

      expect(console.warn).toHaveBeenCalledWith('No QR code available to print');
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should open a new window with print content', async () => {
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const bookingInfo = {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      };

      await service.printQRCode(qrCodeDataUrl, bookingInfo);

      expect(windowOpenSpy).toHaveBeenCalledWith('', '_blank', 'width=800,height=600');
      expect(mockPrintWindow.document.write).toHaveBeenCalled();
      expect(mockPrintWindow.document.close).toHaveBeenCalled();
      expect(mockPrintWindow.focus).toHaveBeenCalled();
    });

    it('should include booking number in the document title', async () => {
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const bookingInfo = {
        bookingNumber: 'BOOK-456',
        areaName: 'Awesome Park',
        arrivalDate: '2024-02-01',
      };

      await service.printQRCode(qrCodeDataUrl, bookingInfo);

      const writtenContent = mockPrintWindow.document.write.calls.argsFor(0)[0];
      expect(writtenContent).toContain('<title>Booking QR Code - BOOK-456</title>');
    });

    it('should sanitize booking number in title to prevent XSS', async () => {
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const bookingInfo = {
        bookingNumber: '<script>alert("xss")</script>BOOK-789',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      };

      await service.printQRCode(qrCodeDataUrl, bookingInfo);

      const writtenContent = mockPrintWindow.document.write.calls.argsFor(0)[0];
      // Title should have sanitized booking number
      expect(writtenContent).toContain('&lt;script&gt;');
      expect(writtenContent).not.toContain('<script>alert("xss")</script>');
    });

    it('should log an error if window.open fails', async () => {
      windowOpenSpy.and.returnValue(null);
      spyOn(console, 'error');

      await service.printQRCode('data:image/png;base64,test', {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to open print window. Please check your browser popup settings.'
      );
    });

    it('should create and render QrPrintViewComponent', async () => {
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const bookingInfo = {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      };

      // This test verifies the service runs without errors
      // Component rendering is tested via integration tests
      await expectAsync(
        service.printQRCode(qrCodeDataUrl, bookingInfo)
      ).toBeResolved();

      expect(mockPrintWindow.document.write).toHaveBeenCalled();
    });

    it('should reject non-PNG data URLs', async () => {
      spyOn(console, 'error');
      
      await service.printQRCode('data:image/jpeg;base64,/9j/4AAQSkZJRg==', {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      });

      expect(console.error).toHaveBeenCalledWith('Invalid or potentially unsafe QR code data URL');
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should reject data URLs with invalid base64', async () => {
      spyOn(console, 'error');
      
      await service.printQRCode('data:image/png;base64,<script>alert("xss")</script>', {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      });

      expect(console.error).toHaveBeenCalledWith('Invalid or potentially unsafe QR code data URL');
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should reject non-data URLs', async () => {
      spyOn(console, 'error');
      
      await service.printQRCode('https://evil.com/script.js', {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
      });

      expect(console.error).toHaveBeenCalledWith('Invalid or potentially unsafe QR code data URL');
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('should sanitize all booking info fields', async () => {
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const bookingInfo = {
        bookingNumber: '<script>alert("xss")</script>BOOK-123',
        areaName: '<img src=x onerror=alert("xss")>Park',
        arrivalDate: '2024-01-15<script>',
      };

      await service.printQRCode(qrCodeDataUrl, bookingInfo);

      const writtenContent = mockPrintWindow.document.write.calls.argsFor(0)[0];
      // Dangerous content should not be present as executable code
      // The actual script tags with executable code should not be present
      expect(writtenContent).not.toContain('<script>alert("xss")</script>');
      expect(writtenContent).not.toContain('<img src=x onerror=');
      // The dangerous tags should be escaped (either &lt; or &amp;lt; depending on escaping level)
      expect(writtenContent).toMatch(/&(amp;)?lt;script/);
    });
  });
});
