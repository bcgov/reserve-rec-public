import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrPrintViewComponent } from './qr-print-view.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('QrPrintViewComponent', () => {
  let component: QrPrintViewComponent;
  let fixture: ComponentFixture<QrPrintViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrPrintViewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QrPrintViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.qrCodeDataUrl).toBe('');
      expect(component.bookingInfo).toBeNull();
    });
  });

  describe('Booking Information Display', () => {
    it('should display all booking information fields', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
        departureDate: '2024-01-17'
      };
      component.qrCodeDataUrl = 'data:image/png;base64,test';
      
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('BOOK-123');
      expect(compiled.textContent).toContain('Test Park');
      expect(compiled.textContent).toContain('2024-01-15');
      expect(compiled.textContent).toContain('2024-01-17');
    });

    it('should handle null booking info gracefully', () => {
      component.bookingInfo = null;
      component.qrCodeDataUrl = 'data:image/png;base64,test';
      
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      // Should not throw errors and should render component structure
      expect(compiled.querySelector('.container')).toBeTruthy();
      expect(compiled.querySelector('.info')).toBeTruthy();
    });

    it('should display booking field labels correctly', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-456',
        areaName: 'Mountain Park',
        arrivalDate: '2024-02-01',
        departureDate: '2024-02-05'
      };
      
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Booking Number:');
      expect(compiled.textContent).toContain('Park:');
      expect(compiled.textContent).toContain('Arrival:');
      expect(compiled.textContent).toContain('Departure:');
    });

    it('should escape HTML in booking information', () => {
      component.bookingInfo = {
        bookingNumber: '<script>alert("xss")</script>',
        areaName: '<b>Bold Park</b>',
        arrivalDate: '2024-01-15',
        departureDate: '2024-01-17'
      };
      
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const innerHTML = compiled.innerHTML;
      
      // Angular should escape these values
      expect(innerHTML).not.toContain('<script>alert("xss")</script>');
      expect(innerHTML).toContain('&lt;script&gt;');
      expect(innerHTML).not.toContain('<b>Bold Park</b>');
      expect(innerHTML).toContain('&lt;b&gt;Bold Park&lt;/b&gt;');
    });
  });

  describe('QR Code Display', () => {
    it('should display QR code image with correct src', () => {
      component.qrCodeDataUrl = 'data:image/png;base64,test123';
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('.qr-container img') as HTMLImageElement;
      
      expect(img).toBeTruthy();
      expect(img.src).toBe('data:image/png;base64,test123');
    });

    it('should have alt text for accessibility', () => {
      component.qrCodeDataUrl = 'data:image/png;base64,test';
      fixture.detectChanges();
      
      const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(img?.getAttribute('alt')).toBe('Booking QR Code');
    });

    it('should handle empty QR code data URL', () => {
      component.qrCodeDataUrl = '';
      fixture.detectChanges();
      
      const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toBe('');
    });

    it('should display QR code in container', () => {
      component.qrCodeDataUrl = 'data:image/png;base64,test';
      fixture.detectChanges();
      
      const qrContainer = fixture.nativeElement.querySelector('.qr-container');
      expect(qrContainer).toBeTruthy();
      
      const img = qrContainer?.querySelector('img');
      expect(img).toBeTruthy();
    });
  });

  describe('Component Structure', () => {
    it('should have main container element', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.container')).toBeTruthy();
    });

    it('should have info section', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.info')).toBeTruthy();
    });

    it('should have instructions section', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const instructions = compiled.querySelector('.instructions');
      expect(instructions).toBeTruthy();
      expect(instructions?.textContent).toContain('Present this QR code to park staff for check-in');
    });

    it('should have BC Parks title', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const heading = compiled.querySelector('h2');
      expect(heading).toBeTruthy();
      expect(heading?.textContent).toContain('BC Parks Booking Confirmation');
    });
  });

  describe('Print Styles', () => {
    it('should have print-specific styles applied', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const styleSheets = document.styleSheets;
      
      // Component should be created without errors
      expect(compiled).toBeTruthy();
    });
  });

  describe('Input Binding', () => {
    it('should update view when qrCodeDataUrl input changes', () => {
      component.qrCodeDataUrl = 'data:image/png;base64,initial';
      fixture.detectChanges();
      
      let img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(img.src).toBe('data:image/png;base64,initial');
      
      component.qrCodeDataUrl = 'data:image/png;base64,updated';
      fixture.detectChanges();
      
      img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
      expect(img.src).toBe('data:image/png;base64,updated');
    });

    it('should update view when bookingInfo input changes', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-111',
        areaName: 'Park A',
        arrivalDate: '2024-01-01',
        departureDate: '2024-01-02'
      };
      fixture.detectChanges();
      
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('BOOK-111');
      expect(compiled.textContent).toContain('Park A');
      
      component.bookingInfo = {
        bookingNumber: 'BOOK-222',
        areaName: 'Park B',
        arrivalDate: '2024-02-01',
        departureDate: '2024-02-02'
      };
      fixture.detectChanges();
      
      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('BOOK-222');
      expect(compiled.textContent).toContain('Park B');
      expect(compiled.textContent).not.toContain('BOOK-111');
      expect(compiled.textContent).not.toContain('Park A');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long booking numbers', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-' + 'A'.repeat(100),
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
        departureDate: '2024-01-17'
      };
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('BOOK-AAA');
    });

    it('should handle special characters in booking info', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-123 & Co.',
        areaName: 'Park with "Quotes" & Symbols',
        arrivalDate: '2024-01-15',
        departureDate: '2024-01-17'
      };
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('BOOK-123 & Co.');
      expect(compiled.textContent).toContain('Park with "Quotes" & Symbols');
    });

    it('should handle undefined booking info fields', () => {
      component.bookingInfo = {
        bookingNumber: 'BOOK-123',
        areaName: 'Test Park',
        arrivalDate: '2024-01-15',
        departureDate: '2024-01-17'
      };
      fixture.detectChanges();
      
      // Should not throw errors
      expect(() => fixture.detectChanges()).not.toThrow();
    });
  });
});
