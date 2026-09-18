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
