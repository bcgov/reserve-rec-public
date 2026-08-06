import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDetailsComponent } from './account-details.component';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { provideRouter } from '@angular/router';

const MOCK_USER = {
  given_name: 'Test',
  family_name: 'User',
  email: 'test@test.com',
  'custom:streetAddress': '123 Main St',
  'custom:unitNumber': '4',
  'custom:city': 'Vancouver',
  'custom:province': 'British Columbia',
  'custom:postalCode': 'V9C 4G1',
  'custom:country': 'Canada',
  'custom:mobilePhone': '6786786761',
  'custom:secondaryNumber': '8989090981',
  'custom:licensePlate': 'ABC123',
  'custom:vehicleRegLocale': 'Yukon',
};

describe('AccountDetailsComponent', () => {
  let component: AccountDetailsComponent;
  let fixture: ComponentFixture<AccountDetailsComponent>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService',
      ['getCurrentUser', 'isBcscUser', 'checkEmailVerification', 'updateUserProfile', 'logout', 'handleResendAttributeCodeToEmail']);
    authService.getCurrentUser.and.returnValue(MOCK_USER);
    authService.isBcscUser.and.returnValue(false);
    authService.checkEmailVerification.and.resolveTo(true);
    authService.updateUserProfile.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [AccountDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['addMessage']) },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function formCount(): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('form').length;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // QA send-back #63: read-only details and the edit form were both on the page
  // at once, with the Edit button still showing. The two blocks must be mutually
  // exclusive for every value of `editing`.
  describe('edit sections are mutually exclusive', () => {
    it('shows read-only details and no form when not editing', () => {
      expect(component.editing).toBeNull();
      expect(text()).toContain('Phone numbers');
      expect(formCount()).toBe(0);
    });

    it('hides the read-only contact details while editing contact', () => {
      component.startEdit('contact');
      fixture.detectChanges();

      expect(text()).not.toContain('Phone numbers');
      expect(formCount()).toBe(1);
    });

    it('hides the read-only vehicle details while editing vehicle', () => {
      component.startEdit('vehicle');
      fixture.detectChanges();

      expect(text()).not.toContain('ABC123, Yukon');
      expect(formCount()).toBe(1);
    });

    it('restores the read-only view and removes the form after a successful save', async () => {
      component.startEdit('contact');
      fixture.detectChanges();
      expect(formCount()).toBe(1);

      await component.saveContact();
      fixture.detectChanges();

      expect(component.editing).toBeNull();
      expect(formCount()).toBe(0);
      expect(text()).toContain('Phone numbers');
    });

    it('keeps the form open when the save fails', async () => {
      authService.updateUserProfile.and.rejectWith(new Error('nope'));
      component.startEdit('contact');
      fixture.detectChanges();

      await component.saveContact();
      fixture.detectChanges();

      expect(component.editing).toBe('contact');
      expect(formCount()).toBe(1);
    });
  });

  // #634 item 6: while one section is being edited, the other sections should
  // still look enabled — only their buttons are disabled.
  it('does not dim the other cards while editing', () => {
    component.startEdit('contact');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.card.opacity-50').length).toBe(0);

    const editButtons = [...el.querySelectorAll('button')]
      .filter(b => (b.textContent ?? '').trim() === 'Edit') as HTMLButtonElement[];
    expect(editButtons.length).toBeGreaterThan(0);
    expect(editButtons.every(b => b.disabled)).toBeTrue();
  });

  it('only allows one card to be edited at a time', () => {
    component.startEdit('contact');
    component.startEdit('vehicle');

    expect(component.editing).toBe('contact');
  });

  // Cancel is the same editing -> null transition as a successful save, and it
  // needs the same explicit teardown. Both cards share cancelEdit().
  ([['contact', 0], ['vehicle', 1]] as const).forEach(([section, editIndex]) => {
    it(`removes the ${section} form after clicking Cancel, without a manual detectChanges`, async () => {
      fixture.autoDetectChanges(true);
      const el = fixture.nativeElement as HTMLElement;

      const edit = [...el.querySelectorAll('button')]
        .filter(b => (b.textContent ?? '').trim() === 'Edit')[editIndex] as HTMLButtonElement;
      edit.click();
      await fixture.whenStable();
      expect(component.editing).toBe(section);
      expect(el.querySelectorAll('form').length).toBe(1);

      const cancel = Array.from(el.querySelectorAll('form button'))
        .find(b => (b.textContent ?? '').trim() === 'Cancel') as HTMLButtonElement;
      cancel.click();
      await fixture.whenStable();

      expect(component.editing).toBeNull();
      expect(el.querySelectorAll('form').length).toBe(0);
      expect(el.textContent).toContain('Phone numbers');
    });
  });

  // Drives the component the way a browser does — a real click on Save, with
  // zone-driven change detection rather than a manual detectChanges().
  it('removes the form after clicking Save, without a manual detectChanges', async () => {
    fixture.autoDetectChanges(true);

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.card-header button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelectorAll('form').length).toBe(1);

    const save = Array.from(el.querySelectorAll('form button'))
      .find(b => (b.textContent ?? '').trim() === 'Save') as HTMLButtonElement;
    save.click();
    await fixture.whenStable();

    expect(component.editing).toBeNull();
    expect(el.querySelectorAll('form').length).toBe(0);
    expect(el.textContent).toContain('Phone numbers');
  });

  // #634 item 3: Cancel is a button in the design, not a text link.
  ['contact', 'vehicle'].forEach(section => {
    it(`renders Cancel as a button rather than a link in the ${section} form`, () => {
      component.startEdit(section as any);
      fixture.detectChanges();

      const cancel = Array.from(fixture.nativeElement.querySelectorAll('form button'))
        .find((b: any) => (b.textContent ?? '').trim() === 'Cancel') as HTMLButtonElement;

      expect(cancel).toBeTruthy();
      expect(cancel.classList).not.toContain('btn-link');
      expect(cancel.classList).toContain('btn-outline-primary');
    });
  });

  // #634 item 4: on narrow screens the cards read Contact, Vehicle, Account
  // management. lg+ keeps the original 8 + 4 row followed by Vehicle.
  it('stacks the cards in the designed order on mobile without changing the lg layout', () => {
    const columns = Array.from(
      fixture.nativeElement.querySelectorAll('.row > div[class*="col-lg"]')
    ) as HTMLElement[];

    const labelled = columns.map(col => ({
      // The Vehicle header carries a nested "(optional)" span; drop it so the
      // assertion reads as the card names themselves.
      title: col.querySelector('.card-header span')!.textContent!.replace(/\s*\(optional\)\s*$/, '').trim(),
      classes: col.className,
    }));

    const mobile = (c: string) => Number(/(?:^|\s)order-(\d)(?:\s|$)/.exec(c)![1]);
    const desktop = (c: string) => {
      const lg = /order-lg-(\d)/.exec(c);
      return lg ? Number(lg[1]) : mobile(c);
    };

    expect([...labelled].sort((a, b) => mobile(a.classes) - mobile(b.classes)).map(c => c.title))
      .toEqual(['Contact information', 'Vehicle information', 'Account management']);

    expect([...labelled].sort((a, b) => desktop(a.classes) - desktop(b.classes)).map(c => c.title))
      .toEqual(['Contact information', 'Account management', 'Vehicle information']);
  });
});
