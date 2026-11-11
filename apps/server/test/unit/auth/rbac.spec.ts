import { describe, expect, it } from 'vitest';
import {
  isKnownRole,
  parseRoleList,
  permissionsForRoles,
  roles,
} from '../../../src/auth/rbac.ts';

describe('roles', () => {
  it('admin allows user:set-role', () => {
    expect(roles.admin.authorize({ user: ['set-role'] })).toEqual({
      success: true,
    });
  });

  it('user denies user:set-role', () => {
    expect(roles.user.authorize({ user: ['set-role'] }).success).toBe(false);
  });

  it('both roles allow the investigative wallet permissions', () => {
    expect(roles.admin.authorize({ wallet: ['list'] })).toEqual({
      success: true,
    });
    expect(roles.user.authorize({ wallet: ['list'] })).toEqual({
      success: true,
    });
  });

  it('only admin reaches the metrics and identity surfaces', () => {
    expect(roles.user.authorize({ admin: ['read'] }).success).toBe(false);
    expect(roles.admin.authorize({ admin: ['read'] }).success).toBe(true);
    expect(roles.user.authorize({ user: ['list'] }).success).toBe(false);
  });
});

describe('parseRoleList', () => {
  it('trims, splits and drops empty entries', () => {
    expect(parseRoleList(' admin , user ,')).toEqual(['admin', 'user']);
  });

  it('returns an empty array for null/undefined', () => {
    expect(parseRoleList(null)).toEqual([]);
    expect(parseRoleList(undefined)).toEqual([]);
  });
});

describe('isKnownRole', () => {
  it('accepts configured roles', () => {
    expect(isKnownRole('admin')).toBe(true);
    expect(isKnownRole('user')).toBe(true);
  });

  it('rejects unknown roles', () => {
    expect(isKnownRole('ghost')).toBe(false);
    expect(isKnownRole('operations')).toBe(false);
  });
});

describe('permissionsForRoles', () => {
  it('expands admin into all permissions, sorted', () => {
    const permissions = permissionsForRoles('admin');

    expect(permissions).toContain('user:set-role');
    expect(permissions).toContain('session:revoke');
    expect(permissions).toContain('wallet:list');
    expect(permissions).toEqual([...permissions].sort());
  });

  it('grants the user role its investigative permissions', () => {
    expect(permissionsForRoles('user')).toEqual([
      'decision:create',
      'decision:read',
      'dossier:export',
      'dossier:read',
      'label:read',
      'settings:read',
      'settings:update',
      'trace:read',
      'wallet:create',
      'wallet:get',
      'wallet:list',
    ]);
  });

  it('unions multiple roles', () => {
    expect(permissionsForRoles('admin,user')).toEqual(
      permissionsForRoles('admin'),
    );
  });

  it('ignores unknown roles', () => {
    expect(permissionsForRoles('ghost')).toEqual([]);
  });
});
