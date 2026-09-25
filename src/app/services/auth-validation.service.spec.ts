import { AuthValidationService } from './auth-validation.service';

describe('AuthValidationService.validatePassword', () => {
  const service = new AuthValidationService();

  it('accepts underscore as the special character (matches Cognito)', () => {
    // Regression for the client-side class that omitted "_" though Cognito accepts it.
    expect(service.validatePassword('Summer_2026')).toBe('');
  });

  it('accepts other Cognito symbols the old class rejected', () => {
    for (const pw of ['Summer-2026', 'Summer=2026', 'Summer~2026', 'Summer[2026]']) {
      expect(service.validatePassword(pw)).toBe('');
    }
  });

  it('still requires a symbol', () => {
    expect(service.validatePassword('Summer2026')).toBe(
      'Password must contain at least one special character'
    );
  });

  it('still enforces the other Cognito rules', () => {
    expect(service.validatePassword('short1!')).toBe('Password must be at least 8 characters');
    expect(service.validatePassword('summer_2026')).toBe('Password must contain at least one uppercase letter');
    expect(service.validatePassword('SUMMER_2026')).toBe('Password must contain at least one lowercase letter');
    expect(service.validatePassword('Summer_password')).toBe('Password must contain at least one number');
  });
});

describe('AuthValidationService.validateMobilePhone', () => {
  const service = new AuthValidationService();

  it('accepts a NANP number however it is punctuated', () => {
    for (const number of ['2505550123', '(250) 555-0123', '+1 250 555 0123']) {
      expect(service.validateMobilePhone(number)).toBe('');
    }
  });

  it('accepts an international number in E.164', () => {
    expect(service.validateMobilePhone('+447911123456')).toBe('');
  });

  it('refuses a number too short to reach anyone', () => {
    // Regression for #888: the old {1,14} accepted anything from two digits
    // up, so a 6-digit number was stored on a real account.
    for (const number of ['586588', '12', '+44 20 7946']) {
      expect(service.validateMobilePhone(number)).toContain('must be a valid phone number');
    }
  });

  it('still requires a mobile number at sign-up', () => {
    expect(service.validateMobilePhone('')).toBe('Mobile phone is required');
  });

  it('leaves the optional home number alone when it is blank', () => {
    expect(service.validatePhoneNumber('', 'Home phone')).toBe('');
    expect(service.validatePhoneNumber('586588', 'Home phone')).toContain('must be a valid phone number');
  });
});
