import type { z } from 'zod';

/**
 * Thrown when the SDL emitter meets a zod construct it cannot map honestly.
 * Generation fails loudly; the emitter never widens a type silently.
 */
export class SdlEmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SdlEmitError';
  }
}

/**
 * A served output type: a zod object plus the few mappings zod cannot
 * express itself.
 */
export interface OutputTypeDecl {
  /** The object schema that defines the type's fields. */
  schema: z.ZodType;
  /**
   * Fields the SDL serves through GraphQL's `ID` scalar. zod only knows
   * `string`; the wire registry is where the zod→SDL mapping lives.
   */
  ids?: readonly string[];
}

/** One served query or mutation field. */
export interface OperationDecl {
  /**
   * The field's SDL return type, e.g. `WalletPage!`, `AuthUser` or
   * `[AuthSessionInfo!]!`.
   */
  type: string;
  /**
   * The field's arguments as one zod object; the object's fields become the
   * argument list, `.default()` values included.
   */
  args?: z.ZodType;
  /** Argument names the SDL serves through GraphQL's `ID` scalar. */
  ids?: readonly string[];
  /** Emitted verbatim as `#` lines above the field. */
  comment?: readonly string[];
}

/**
 * A declarative map from the zod contracts to one served SDL file. This is
 * the only place the mapping is stated; `generate:sdl` turns it into GraphQL
 * text. Names are how the emitter resolves nested references: `z.array(
 * walletListItemSchema)` becomes `[WalletListItem!]!` because
 * `walletListItemSchema` is registered as `WalletListItem`.
 *
 * What SDL cannot express stays a runtime fact of the contract: `.regex()`
 * and `.trim()` fields are plain `String`s, and every `superRefine`
 * invariant is enforced by the server's service parse. A reader of the
 * generated SDL must not assume the SDL *is* the contract.
 */
export interface WireModule {
  /** The module's name, used in error messages. */
  name: string;
  /** Emit `type Query` / `type Mutation` instead of `extend type ...` (root only). */
  root?: boolean;
  /** Custom scalars this module declares (e.g. `Date`). */
  scalars?: readonly string[];
  enums?: Record<string, z.ZodType>;
  outputTypes?: Record<string, z.ZodType | OutputTypeDecl>;
  query?: Record<string, OperationDecl>;
  mutation?: Record<string, OperationDecl>;
}

/** Declares one served SDL file. Nothing is inferred beyond the declaration. */
export function defineWireModule(module: WireModule): WireModule {
  return module;
}
