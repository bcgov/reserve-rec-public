import { Injectable } from '@angular/core';

export interface SignUpFormData {
  email: string;
  password: string;
  givenName: string;
  familyName: string;
  mobilePhone?: string;
  homePhone?: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface SignUpValidationErrors {
  emailError: string;
  passwordError: string;
  givenNameError: string;
  familyNameError: string;
  mobilePhoneError: string;
  homePhoneError: string;
  streetAddressError: string;
  cityError: string;
  provinceError: string;
  postalCodeError: string;
  countryError: string;
}

export interface SignInValidationErrors {
  emailError: string;
  passwordError: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthValidationService {
  validateEmail(email: string): string {
    if (!email?.trim()) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  validatePassword(password: string): string {
    if (!password?.trim()) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return '';
  }

  validateName(name: string, fieldLabel: string): string {
    if (!name?.trim()) {
      return `${fieldLabel} is required`;
    }
    // Allow letters, spaces, hyphens, and periods
    const nameRegex = /^[a-zA-Z\s.-]+$/;
    if (!nameRegex.test(name)) {
      return `${fieldLabel} can only contain letters, spaces, hyphens, and periods`;
    }
    // Ensure at least one letter is present
    if (!/[a-zA-Z]/.test(name)) {
      return `${fieldLabel} must contain at least one letter`;
    }
    return '';
  }

  validatePhoneNumber(phone: string, fieldLabel: string): string {
    if (!phone?.trim()) {
      return ''; // Optional field
    }
    return this.validatePhoneFormat(phone, fieldLabel);
  }

  // Account settings already require a mobile number, so sign-up asks for one
  // too rather than letting an account start out unable to save its own
  // contact details (#685).
  validateMobilePhone(phone: string): string {
    if (!phone?.trim()) {
      return 'Mobile phone is required';
    }
    return this.validatePhoneFormat(phone, 'Mobile phone');
  }

  private validatePhoneFormat(phone: string, fieldLabel: string): string {
    // E.164 format: +[country code][number], e.g., +12345678900 or +1-234-567-8900
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      return `${fieldLabel} must be a valid phone number, e.g. +1 (250) 555-1234`;
    }
    return '';
  }

  validateStreetAddress(address: string): string {
    if (!address?.trim()) {
      return 'Street address is required';
    }
    return '';
  }

  validateCity(city: string): string {
    if (!city?.trim()) {
      return 'City is required';
    }
    // Only letters and spaces allowed
    const cityRegex = /^[a-zA-Z\s-]+$/;
    if (!cityRegex.test(city)) {
      return 'City can only contain letters, spaces, and hyphens';
    }
    return '';
  }

  validateProvince(province: string): string {
    if (!province?.trim()) {
      return 'Province is required';
    }
    // Only letters and spaces allowed
    const provinceRegex = /^[a-zA-Z\s-]+$/;
    if (!provinceRegex.test(province)) {
      return 'Province can only contain letters, spaces, and hyphens';
    }
    return '';
  }

  validatePostalCode(postalCode: string): string {
    if (!postalCode?.trim()) {
      return 'Postal code is required';
    }
    // Allow numbers and letters (for postal codes like V8W 9V1)
    const postalCodeRegex = /^[a-zA-Z0-9\s-]+$/;
    if (!postalCodeRegex.test(postalCode)) {
      return 'Postal code can only contain letters, numbers, spaces, and hyphens';
    }
    return '';
  }

  validateCountry(country: string): string {
    if (!country?.trim()) {
      return 'Country is required';
    }
    // Only letters and spaces allowed
    const countryRegex = /^[a-zA-Z\s-]+$/;
    if (!countryRegex.test(country)) {
      return 'Country can only contain letters, spaces, and hyphens';
    }
    return '';
  }

  validateSignUp(input: SignUpFormData): SignUpValidationErrors {

    const errors: SignUpValidationErrors = {
      emailError: this.validateEmail(input.email),
      passwordError: this.validatePassword(input.password),
      givenNameError: this.validateName(input.givenName, 'Given name'),
      familyNameError: this.validateName(input.familyName, 'Surname'),
      mobilePhoneError: this.validateMobilePhone(input.mobilePhone ?? ''),
      homePhoneError: this.validatePhoneNumber(input.homePhone ?? '', 'Home phone number'),
      streetAddressError: this.validateStreetAddress(input.streetAddress),
      cityError: this.validateCity(input.city),
      provinceError: this.validateProvince(input.province),
      postalCodeError: this.validatePostalCode(input.postalCode),
      countryError: this.validateCountry(input.country),
    };

    return errors;
  }

}

