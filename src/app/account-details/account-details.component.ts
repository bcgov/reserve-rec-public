import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ToastService, ToastTypes } from '../services/toast.service';

import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { PROVINCES_STATES } from '../data/provinces-states.data';
import { BreadcrumbComponent } from '../shared/breadcrumb/breadcrumb.component';
import { AccountVerificationComponent } from '../shared/components/account-verification/account-verification.component';

type EditSection = 'contact' | 'vehicle' | null;

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [BreadcrumbComponent, ReactiveFormsModule, NgdsFormsModule, AccountVerificationComponent],
  templateUrl: './account-details.component.html',
  styleUrl: './account-details.component.scss'
})
export class AccountDetailsComponent implements OnInit {
  public editing: EditSection = null;
  public loading = true;
  public saving = false;
  public emailVerified = false;

  public readonly provinces = PROVINCES_STATES;
  public readonly countries = ['Canada', 'United States', 'Other'];

  public contactForm = new FormGroup({
    given_name: new FormControl(''),
    family_name: new FormControl(''),
    streetAddress: new FormControl(''),
    unitNumber: new FormControl(''),
    city: new FormControl(''),
    province: new FormControl(''),
    postalCode: new FormControl(''),
    country: new FormControl(''),
    mobilePhone: new FormControl(''),
    secondaryNumber: new FormControl(''),
  });

  public vehicleForm = new FormGroup({
    licensePlate: new FormControl(''),
    vehicleRegLocale: new FormControl(''),
  });

  constructor(
    private authService: AuthService,
    private toastService: ToastService,
    private cd: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.emailVerified = await this.authService.checkEmailVerification();
    } catch (error) {
      console.log('Error getting email verification status: ', error)
      this.toastService.addMessage("Error getting email verification status.", 'Error', ToastTypes.ERROR);
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

  onEmailVerified() {
    this.emailVerified = true;
    this.cd.detectChanges();
  }

}
