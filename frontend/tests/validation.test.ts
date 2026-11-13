import { describe, expect, it } from '@jest/globals';
import {
  changePasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation';

describe('form validation', () => {
  it('normalises and accepts a valid sign-up form', () => {
    const parsed = signUpSchema.parse({
      name: '  Ada Lovelace ',
      email: ' ADA@Example.COM ',
      password: 'SecurePass1',
    });
    expect(parsed).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'SecurePass1',
    });
  });

  it('rejects weak passwords and malformed emails', () => {
    const result = signUpSchema.safeParse({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    }
  });

  it('requires only a non-empty password when signing in', () => {
    expect(signInSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(
      false,
    );
    expect(signInSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('requires password confirmation to match', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'a'.repeat(32),
      password: 'SecurePass1',
      confirmPassword: 'SecurePass2',
    });
    expect(result.success).toBe(false);
  });

  it('allows a profile update without changing the password', () => {
    expect(profileSchema.safeParse({ name: 'Ada', email: 'ada@example.com' }).success).toBe(
      true,
    );
  });

  it('rejects mismatched confirmation in the change-password form', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SecurePass1',
      newPassword: 'SecurePass1',
      confirmPassword: 'SecurePass2',
    });
    expect(result.success).toBe(false);
  });
});
