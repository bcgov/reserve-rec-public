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
    //Amplifys auto validation will trigger before our validation runs and not allow 
    //This error to ever actually be displayed, its here already incase we remove Amplify-Form-Fields in the future
  validateEmail(email: string): string {
    if (!email?.trim()) {
      console.log('Email empty - returning error');
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Email format invalid - returning error');
      return 'Please enter a valid email address';
    }
    console.log('Email valid - no error');
    return '';
  }

  validatePassword(password: string): string {
    //These validations will actually run, but not until Amplify's built-in has done a pass.
    //The one strange thing here is that we cannot clear the errors unless we resubmit.
    // It feels like a reasonable UX tradeoff to give the proper error but cant auto clear like the 
    // rest of the form, but we can revisit this if it becomes a problem.
    console.log('validatePassword called with length:', password?.length);
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
    // Allow letters, spaces, and hyphens only
    const nameRegex = /^[a-zA-Z\s-]+$/;
    if (!nameRegex.test(name)) {
      return `${fieldLabel} can only contain letters, spaces, and hyphens`;
    }
    return '';
  }

  validatePhoneNumber(phone: string, fieldLabel: string): string {
    if (!phone?.trim()) {
      return ''; // Optional field
    }
    // E.164 format: +[country code][number], e.g., +12345678900 or +1-234-567-8900
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      return `${fieldLabel} must be in format (e.g., +12345678900)`;
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
      familyNameError: this.validateName(input.familyName, 'Family name'),
      mobilePhoneError: this.validatePhoneNumber(input.mobilePhone ?? '', 'Mobile phone number'),
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

