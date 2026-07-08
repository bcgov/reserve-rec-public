import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ToastService, ToastTypes } from '../services/toast.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgdsFormsModule } from '@digitalspace/ngds-forms';
import { PROVINCES_STATES } from '../data/provinces-states.data';

type EditSection = 'contact' | 'vehicle' | null;

@Component({
  selector: 'app-account-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, NgdsFormsModule],
  templateUrl: './account-details.component.html',
  styleUrl: './account-details.component.scss'
})
export class AccountDetailsComponent implements OnInit {
  public editing: EditSection = null;
  public emailVerified = false;
  public saving = false;

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

  constructor(private authService: AuthService, private toastService: ToastService) {}

  async ngOnInit(): Promise<void> {
    this.emailVerified = await this.authService.checkEmailVerification();
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
  }

  async saveContact(): Promise<void> {
    const v = this.contactForm.getRawValue();
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
    } catch (error) {
      this.toastService.addMessage('We could not save your changes. Please try again.', 'Error', ToastTypes.ERROR);
    } finally {
      this.saving = false;
    }
  }

  async resendVerification(): Promise<void> {
    await this.authService.handleResendAttributeCodeToEmail();
    this.toastService.addMessage('Verification email sent. Please check your inbox.', 'Email sent', ToastTypes.SUCCESS);
  }
}
