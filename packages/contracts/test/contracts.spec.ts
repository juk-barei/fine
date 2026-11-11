import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  errorEnvelopeSchema,
  permissionSchema,
  sessionUserSchema,
} from '../src/index.ts';

describe('error contract', () => {
  it('parses a valid REST error envelope', () => {
    const result = errorEnvelopeSchema.safeParse({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid input',
      errors: [{ path: 'email', message: 'Required' }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects an envelope without a status code', () => {
    const result = errorEnvelopeSchema.safeParse({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Missing',
    });

    expect(result.success).toBe(false);
  });
});

describe('auth contract', () => {
  it('accepts session users with resource:action permissions', () => {
    const result = sessionUserSchema.safeParse({
      id: 'usr_1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'admin',
      permissions: ['user:read', 'session:revoke'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed permission strings', () => {
    expect(permissionSchema.safeParse('user-read').success).toBe(false);
    expect(permissionSchema.safeParse('user:read').success).toBe(true);
  });
});

