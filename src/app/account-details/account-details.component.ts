import { ChangeDetectorRef, Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { PROVINCES_STATES } from '../data/provinces-states.data';
import { AuthService } from '../services/auth.service';
import { ToastService, ToastTypes } from '../services/toast.service';
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { AccountVerificationComponent } from '../shared/components/account-verification/account-verification.component';
import { debounceTime } from 'rxjs/operators';
import { Utils } from '../utils/utils';

type EditSection = 'contact' | 'vehicle' | null;

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [BreadcrumbComponent, ReactiveFormsModule, NgdsFormsModule, AccountVerificationComponent],
  templateUrl: './account-details.component.html',
  styleUrl: './account-details.component.scss'
})
export class AccountDetailsComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  public utils = Utils;
  public editing: EditSection = null;
  public loading = true;
  public saving = false;
  public emailVerified = false;

  public readonly provinces = PROVINCES_STATES;
  public readonly countries = ['Canada', 'United States', 'Other'];

  public contactForm = new FormGroup({
    given_name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
    family_name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
    streetAddress: new FormControl('', Validators.required),
    unitNumber: new FormControl(''),
    city: new FormControl('', Validators.required),
    province: new FormControl('', Validators.required),
    postalCode: new FormControl('', Validators.required),
    country: new FormControl('', Validators.required),
    mobilePhone: new FormControl('', [Validators.required, this.phoneValidator.bind(this)]),
    secondaryNumber: new FormControl('', [this.phoneOptionalValidator.bind(this)]),
  });

  public vehicleForm = new FormGroup({
    licensePlate: new FormControl(''),
    vehicleRegLocale: new FormControl(''),
  });

  constructor(
    private authService: AuthService,
    private toastService: ToastService,
    private cd: ChangeDetectorRef,
  ) {
    this.setupNameFormatter(this.contactForm.controls.given_name);
    this.setupNameFormatter(this.contactForm.controls.family_name);
    this.setupPhoneFormatter(this.contactForm.controls.mobilePhone);
    this.setupPhoneFormatter(this.contactForm.controls.secondaryNumber);
  }

  async ngOnInit(): Promise<void> {
    try {
      this.emailVerified = await this.authService.checkEmailVerification();
    } catch (error) {
      console.error('Error getting email verification status: ', error);
      this.toastService.addMessage('Error getting email verification status.', 'Error', ToastTypes.ERROR);
    } finally {
      this.loading = false;
      this.cd.detectChanges();
    }
  }

  get user() {
    return this.authService.getCurrentUser();
  }

  // BCSC users' name/address come from their BC Services Card and are read-only here.
  get isBcsc(): boolean {
    return this.authService.isBcscUser();
  }

  logout() {
    this.authService.logout();
  }

  startEdit(section: Exclude<EditSection, null>): void {
    if (this.editing) return; // one card at a time (the others are disabled)
    const u = this.user || {};
    if (section === 'contact') {
      this.contactForm.reset({
        given_name: u.given_name || '',
        family_name: u.family_name || '',
        streetAddress: u['custom:streetAddress'] || '',
        unitNumber: u['custom:unitNumber'] || '',
        city: u['custom:city'] || '',
        province: u['custom:province'] || '',
        postalCode: u['custom:postalCode'] || '',
        country: u['custom:country'] || '',
        mobilePhone: u['custom:mobilePhone'] || '',
        secondaryNumber: u['custom:secondaryNumber'] || '',
      });
    } else {
      this.vehicleForm.reset({
        licensePlate: u['custom:licensePlate'] || '',
        vehicleRegLocale: u['custom:vehicleRegLocale'] || '',
      });
    }
    this.editing = section;
  }

  cancelEdit(): void {
    this.editing = null;
    // Same teardown problem as save(): clearing `editing` on its own leaves the
    // edit form's view in the DOM alongside the restored read-only details.
    this.cd.detectChanges();
  }

  async saveContact(): Promise<void> {
    const v = this.contactForm.getRawValue();
    
    // Check for empty mandatory fields
    const missingFields: string[] = [];
    
    if (!v.given_name?.trim()) missingFields.push('Given names');
    if (!v.family_name?.trim()) missingFields.push('Surname');
    if (!v.streetAddress?.trim()) missingFields.push('Street address');
    if (!v.city?.trim()) missingFields.push('City');
    if (!v.province?.trim()) missingFields.push('Province or state');
    if (!v.postalCode?.trim()) missingFields.push('Postal or zip code');
    if (!v.country?.trim()) missingFields.push('Country');
    if (!v.mobilePhone?.trim()) missingFields.push('Mobile phone');

    
    // Change numbers to be E.164 format on save if they have the country code attached
    // TODO: should probably have people specify country separately in an input, then enter phone in another input
    if (v.mobilePhone.length > 14) {
      v.mobilePhone = v.mobilePhone.replace(/(?!^\+)\D/g, '');
    } else {
      v.mobilePhone = v.mobilePhone.replace(/\D/g, '');
    }
    if (v.secondaryNumber.length > 14) {
      v.secondaryNumber = v.secondaryNumber.replace(/(?!^\+)\D/g, '');
    } else {
      v.secondaryNumber = v.secondaryNumber.replace(/\D/g, '');
    }
    
    if (missingFields.length > 0) {
      const fieldList = missingFields.join(', ');
      this.toastService.addMessage(`Please fill in the following required fields: ${fieldList}`, 'Validation Error', ToastTypes.ERROR);
      // Mark fields as touched to show error states
      Object.keys(this.contactForm.controls).forEach(key => {
        if (key !== 'unitNumber' && key !== 'secondaryNumber') {
          this.contactForm.get(key)?.markAsTouched();
        }
      });
      return;
    }

    await this.save({
      given_name: v.given_name ?? '',
      family_name: v.family_name ?? '',
      'custom:streetAddress': v.streetAddress ?? '',
      'custom:unitNumber': v.unitNumber ?? '',
      'custom:city': v.city ?? '',
      'custom:province': v.province ?? '',
      'custom:postalCode': v.postalCode ?? '',
      'custom:country': v.country ?? '',
      'custom:mobilePhone': v.mobilePhone ?? '',
      'custom:secondaryNumber': v.secondaryNumber ?? '',
    });
  }

  async saveVehicle(): Promise<void> {
    const v = this.vehicleForm.getRawValue();
    await this.save({
      'custom:licensePlate': v.licensePlate ?? '',
      'custom:vehicleRegLocale': v.vehicleRegLocale ?? '',
    });
  }

  private async save(attributes: Record<string, string>): Promise<void> {
    this.saving = true;
    try {
      await this.authService.updateUserProfile(attributes);
      this.toastService.addMessage('Your account information has been updated.', 'Saved', ToastTypes.SUCCESS);
      this.editing = null;
    } catch {
      this.toastService.addMessage('We could not save your changes. Please try again.', 'Error', ToastTypes.ERROR);
    } finally {
      this.saving = false;
      // `editing` and `saving` are plain properties mutated in a post-await
      // continuation. Without this the edit form's view is not torn down, so the
      // form stays on screen alongside the restored read-only details
      // (QA send-back on #63). Verified: forcing detection here is what the
      // manual ng.applyChanges() reproduction needed to clear it.
      this.cd.detectChanges();
    }
  }

  onEmailVerified(): void {
    this.emailVerified = true;
    this.cd.detectChanges();
  }

  nameValidator(control: AbstractControl): ValidationErrors | null {
    const val = (control.value ?? '').toString().trim();

    // Let empty values pass so Validators.required can handle empty state independently
    if (!val) {
      return null;
    }

    const nameRegex = /^\p{sc=Latin}[\p{sc=Latin}\s'\-.]*$/u;

    if (!nameRegex.test(val)) {
      return { pattern: true }; // Match the error key configured in your template
    }

    return null;
  }

  setupNameFormatter(control: FormControl<string | null>): void {
    control.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(500)
    ).subscribe((value) => {
      if (!value) return;


      // TODO: temporary fix to prevent stacking
      this.cd.detectChanges();
    });
  }

  // required actual data first (phone number entered), then we check the pattern
  phoneValidator(control: AbstractControl): ValidationErrors | null {
    const val = (control.value ?? '').toString();
    const digits = val.replace(/\D/g, '').slice(0,12);

    if (!digits) return { required: true };
    if (digits.length < 10 || digits.length > 12) return { pattern: true };
    return null;
  }

  phoneOptionalValidator(control: AbstractControl): ValidationErrors | null {
    const val = (control.value ?? '').toString();
    const digits = val.replace(/\D/g, '');

    if (!digits) return null;
    if (digits.length < 10 || digits.length > 12) return { pattern: true };
    return null;
  }

  // Pass the digits into the formatter after a short debounce
  // which allow them to go back and edit digits before formatter kicks in
  setupPhoneFormatter(control: FormControl<string | null>): void {
    control.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(500)
    ).subscribe((value) => {
      if (!value) return;

      // Extract up to 12 digits
      const digits = value.replace(/\D/g, '').slice(0,12);
      const formatted = this.utils.formatPhone(digits);
      
      // Only update if the value actually changed to avoid infinite loop
      if (formatted !== value) {
        control.setValue(formatted, { emitEvent: false });
      }

      // TODO: temporary fix to prevent stacking
      this.cd.detectChanges();
    });
  }

  ngOnDestroy(): void {
    // TODO: this is a temporary fix
    this.cd.detectChanges()
  }
}
