import { z } from 'zod';

/** Permission strings use the `resource:action` format. */
export const PERMISSION_PATTERN = /^[a-z_]+:[a-z_-]+$/;

export const permissionSchema = z.string().regex(PERMISSION_PATTERN, {
  message: 'Permission must use the `resource:action` format',
});

/** The authenticated principal, as returned by the `me` query. */
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  permissions: z.array(permissionSchema),
  /** The provider's profile fields; absent until the profile carries them. */
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** One session of the signed-in user, as returned by `mySessions`. */
export const authSessionInfoSchema = z.object({
  id: z.string(),
  /** Crosses the wire through the `Date` scalar, so it is a `Date` here. */
  expiresAt: z.date(),
  createdAt: z.date(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  isCurrent: z.boolean(),
});
export type AuthSessionInfo = z.infer<typeof authSessionInfoSchema>;

/** The `revokeSession` mutation's argument. */
export const revokeSessionInputSchema = z.object({
  sessionId: z.string(),
});
