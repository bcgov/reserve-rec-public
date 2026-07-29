import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';

import { BreadcrumbComponent } from './breadcrumb.component';

@Component({ template: '', standalone: true })
class StubPageComponent {}

describe('BreadcrumbComponent', () => {
  let fixture: ComponentFixture<BreadcrumbComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [
        provideRouter([
          { path: '', component: StubPageComponent },
          {
            path: 'account-details',
            component: StubPageComponent,
            data: { breadcrumb: 'Account settings' }
          },
        ]),
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(BreadcrumbComponent);
  });

  it('renders nothing at the root, where Home is the only crumb', async () => {
    await router.navigateByUrl('/');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.breadcrumb-item').length).toBe(0);
  });

  describe('on a child route', () => {
    beforeEach(async () => {
      await router.navigateByUrl('/account-details');
      fixture.detectChanges();
    });

    it('renders Home and the route breadcrumb label', () => {
      const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.breadcrumb-item')]
        .map(el => (el.textContent ?? '').trim());

      expect(labels).toEqual(['Home', 'Account settings']);
    });

    // #630: the separator must be spaced away from the labels. The previous
    // hand-rolled breadcrumb relied on a whitespace text node between elements,
    // which Angular strips (preserveWhitespaces defaults to false).
    it('renders a separator that carries its own horizontal padding', () => {
      const separator = (fixture.nativeElement as HTMLElement).querySelector('.breadcrumb-separator');

      expect(separator).withContext('separator element is present').not.toBeNull();
      expect(separator!.querySelector('i.fa-chevron-right'))
        .withContext('separator uses the chevron icon').not.toBeNull();

      const padding = getComputedStyle(separator as Element);
      expect(parseFloat(padding.paddingLeft)).toBeGreaterThan(0);
      expect(parseFloat(padding.paddingRight)).toBeGreaterThan(0);
    });
  });
});
