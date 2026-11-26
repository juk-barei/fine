import type { z } from 'zod';
import {
  SdlEmitError,
  type OperationDecl,
  type OutputTypeDecl,
  type WireModule,
} from './registry.ts';

/** The scalars GraphQL defines itself; everything else must be declared. */
const BUILTIN_SCALARS: Record<string, true> = {
  String: true,
  Int: true,
  Float: true,
  Boolean: true,
  ID: true,
};

/** The zod v4 introspection surface: every schema exposes `_zod.def`. */
interface ZodDef {
  type: string;
  innerType?: unknown;
  element?: unknown;
  defaultValue?: unknown;
  checks?: unknown;
  entries?: unknown;
  shape?: unknown;
}

/** Type guard: registry entries are either a bare schema or a decl object. */
function isOutputDecl(entry: z.ZodType | OutputTypeDecl): entry is OutputTypeDecl {
  return typeof entry === 'object' && entry !== null && 'schema' in entry;
}

function defOf(schema: z.ZodType, path: string): ZodDef {
  const def = (schema as unknown as { _zod?: { def?: ZodDef } })._zod?.def;
  if (!def || typeof def.type !== 'string') {
    throw new SdlEmitError(`cannot introspect the zod schema at ${path}`);
  }
  return def;
}

function requireInnerType(def: ZodDef, path: string): z.ZodType {
  const inner = def.innerType as z.ZodType | undefined;
  if (!inner) {
    throw new SdlEmitError(`cannot read the wrapped schema at ${path}`);
  }
  return inner;
}

/** `z.number().int()` declares its format through a `number_format` check. */
function isInteger(def: ZodDef): boolean {
  const checks = def.checks as
    | Array<{ _zod?: { def?: { check?: string; format?: unknown } } }>
    | undefined;
  return (checks ?? []).some((check) => {
    const checkDef = check._zod?.def;
    return (
      checkDef?.check === 'number_format' &&
      (checkDef.format === 'int' || checkDef.format === 'safeint')
    );
  });
}

/**
 * One zod schema's SDL counterpart, with the wrappers resolved:
 * `.nullable()`/`.optional()` drop the `!`, `.default()` keeps the value for
 * argument emission, and `z.array` builds the list type.
 */
interface MappedField {
  /** The SDL type without its trailing `!` and without any default. */
  base: string;
  /** True when the SDL type must not carry `!`. */
  nullable: boolean;
  /** Present (not `undefined`) when the schema declares a default value. */
  defaultValue?: unknown;
}

function mapField(
  schema: z.ZodType,
  named: Map<z.ZodType, string>,
  path: string,
): MappedField {
  const registered = named.get(schema);
  if (registered !== undefined) {
    return { base: registered, nullable: false };
  }

  const def = defOf(schema, path);

  switch (def.type) {
    case 'optional':
    case 'nullable':
      return { ...mapField(requireInnerType(def, path), named, path), nullable: true };
    case 'default': {
      const value =
        typeof def.defaultValue === 'function'
          ? (def.defaultValue as () => unknown)()
          : def.defaultValue;
      return {
        ...mapField(requireInnerType(def, path), named, path),
        nullable: true,
        defaultValue: value,
      };
    }
    case 'array': {
      const element = def.element as z.ZodType | undefined;
      if (!element) {
        throw new SdlEmitError(`cannot read the array element at ${path}`);
      }
      const mapped = mapField(element, named, path);
      return {
        base: `[${mapped.base}${mapped.nullable ? '' : '!'}]`,
        nullable: false,
      };
    }
    case 'string':
      return { base: 'String', nullable: false };
    case 'boolean':
      return { base: 'Boolean', nullable: false };
    case 'date':
      return { base: 'Date', nullable: false };
    case 'number':
      return { base: isInteger(def) ? 'Int' : 'Float', nullable: false };
    case 'enum':
      throw new SdlEmitError(
        `the zod enum at ${path} is not registered under a name in the wire registry — register it so the SDL can name it`,
      );
    case 'object':
      throw new SdlEmitError(
        `the unnamed zod object at ${path} cannot be served — register the type in the wire registry so the SDL can name it`,
      );
    default:
      throw new SdlEmitError(
        `unmappable zod construct '${def.type}' at ${path} — the wire registry must stay within the SDL-expressible subset`,
      );
  }
}

/** Fields served as `ID` are plain zod strings; anything else is a registry mistake. */
function applyIdOverride(
  mapped: MappedField,
  fieldName: string,
  ids: ReadonlySet<string>,
  owner: string,
): MappedField {
  if (!ids.has(fieldName)) {
    return mapped;
  }
  if (mapped.base !== 'String') {
    throw new SdlEmitError(
      `${owner} declares '${fieldName}' as ID, but its zod schema maps to '${mapped.base}'`,
    );
  }
  return { ...mapped, base: 'ID' };
}

function renderDefault(value: unknown, path: string): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  throw new SdlEmitError(`cannot render the default value at ${path} as SDL`);
}

/** One top-level definition of the emitted SDL, in the registry's order. */
interface SdlBlock {
  text: string;
  /** Type and scalar names referenced beyond GraphQL's built-ins. */
  references: string[];
}

function identifiers(text: string): string[] {
  return [...text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)]
    .filter((match) => !BUILTIN_SCALARS[match[0]])
    .map((match) => match[0]);
}

function enumValues(def: ZodDef, name: string): string[] {
  const entries = def.entries as
    | Array<[string, unknown]>
    | Record<string, unknown>
    | undefined;
  const values = Array.isArray(entries)
    ? entries.map(([, value]) => value)
    : entries
      ? Object.values(entries)
      : undefined;
  if (!values || values.some((value) => typeof value !== 'string')) {
    throw new SdlEmitError(
      `cannot read the values of the '${name}' enum — the wire registry expects a zod enum of strings`,
    );
  }
  for (const value of values as string[]) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      throw new SdlEmitError(
        `the '${name}' enum has the value '${value}', which is not a legal GraphQL name`,
      );
    }
  }
  return values as string[];
}

function outputTypeBlock(
  name: string,
  decl: z.ZodType | OutputTypeDecl,
  named: Map<z.ZodType, string>,
): SdlBlock {
  const schema = isOutputDecl(decl) ? decl.schema : decl;
  const ids = new Set(isOutputDecl(decl) ? (decl.ids ?? []) : []);
  const def = defOf(schema, `type ${name}`);
  if (def.type !== 'object') {
    throw new SdlEmitError(
      `the '${name}' output type is a '${def.type}' schema, not a zod object`,
    );
  }
  const shape = def.shape as Record<string, z.ZodType> | undefined;
  if (!shape) {
    throw new SdlEmitError(`cannot read the fields of the '${name}' output type`);
  }

  const lines: string[] = [];
  const references: string[] = [];
  for (const [field, fieldSchema] of Object.entries(shape)) {
    const mapped = applyIdOverride(
      mapField(fieldSchema, named, `${name}.${field}`),
      field,
      ids,
      `type ${name}`,
    );
    if (mapped.defaultValue !== undefined) {
      throw new SdlEmitError(
        `default values are only expressible on arguments, but ${name}.${field} declares one`,
      );
    }
    references.push(...identifiers(mapped.base));
    lines.push(`  ${field}: ${mapped.base}${mapped.nullable ? '' : '!'}`);
  }

  return { text: `type ${name} {\n${lines.join('\n')}\n}`, references };
}

function operationLines(
  field: string,
  decl: OperationDecl,
  moduleName: string,
  named: Map<z.ZodType, string>,
  references: string[],
): string[] {
  const lines: string[] = [];
  for (const comment of decl.comment ?? []) {
    lines.push(`  # ${comment}`);
  }

  let argsPart = '';
  if (decl.args) {
    const def = defOf(decl.args, `${moduleName}.${field} arguments`);
    if (def.type !== 'object') {
      throw new SdlEmitError(
        `the arguments of ${moduleName}.${field} are a '${def.type}' schema, not a zod object`,
      );
    }
    const shape = def.shape as Record<string, z.ZodType> | undefined;
    if (!shape) {
      throw new SdlEmitError(`cannot read the arguments of ${moduleName}.${field}`);
    }
    const rendered = Object.entries(shape).map(([arg, argSchema]) => {
      const path = `${moduleName}.${field}(${arg})`;
      const mapped = applyIdOverride(
        mapField(argSchema, named, path),
        arg,
        new Set(decl.ids ?? []),
        `${moduleName}.${field}`,
      );
      references.push(...identifiers(mapped.base));
      const bang = mapped.nullable || mapped.defaultValue !== undefined ? '' : '!';
      const withDefault =
        mapped.defaultValue === undefined
          ? ''
          : ` = ${renderDefault(mapped.defaultValue, path)}`;
      return `${arg}: ${mapped.base}${bang}${withDefault}`;
    });
    argsPart = rendered.length > 0 ? `(${rendered.join(', ')})` : '';
  }

  references.push(...identifiers(decl.type));
  lines.push(`  ${field}${argsPart}: ${decl.type}`);
  return lines;
}

/** One emitted SDL file: its text and everything it references by name. */
export interface EmittedModule {
  sdl: string;
  /** Type and scalar names referenced beyond GraphQL's built-ins. */
  referenced: Set<string>;
}

/** Emits one wire module's SDL. References are validated by `emitWireModules`. */
export function emitWireModule(module: WireModule): EmittedModule {
  const named = new Map<z.ZodType, string>();
  for (const [name, schema] of Object.entries(module.enums ?? {})) {
    const def = defOf(schema, `enum ${name}`);
    if (def.type !== 'enum') {
      throw new SdlEmitError(
        `the '${name}' entry of the '${module.name}' registry is a '${def.type}' schema, not a zod enum`,
      );
    }
    named.set(schema, name);
  }
  for (const [name, decl] of Object.entries(module.outputTypes ?? {})) {
    const schema = isOutputDecl(decl) ? decl.schema : decl;
    named.set(schema, name);
  }

  const blocks: SdlBlock[] = [];
  const references: string[] = [];

  for (const scalar of module.scalars ?? []) {
    blocks.push({ text: `scalar ${scalar}`, references: [scalar] });
  }

  for (const [name, schema] of Object.entries(module.enums ?? {})) {
    const values = enumValues(defOf(schema, `enum ${name}`), name)
      .map((value) => `  ${value}`)
      .join('\n');
    blocks.push({ text: `enum ${name} {\n${values}\n}`, references: [name] });
  }

  for (const [name, decl] of Object.entries(module.outputTypes ?? {})) {
    blocks.push(outputTypeBlock(name, decl, named));
  }

  for (const [root, fields] of [
    ['Query', module.query],
    ['Mutation', module.mutation],
  ] as const) {
    const entries = Object.entries(fields ?? {});
    if (entries.length === 0) {
      continue;
    }
    const head = module.root ? `type ${root} {` : `extend type ${root} {`;
    const lines = entries.flatMap(([field, decl]) =>
      operationLines(field, decl, module.name, named, references),
    );
    blocks.push({ text: [head, ...lines, '}'].join('\n'), references: [] });
  }

  return {
    sdl: `${blocks.map((block) => block.text).join('\n\n')}\n`,
    referenced: new Set([
      ...references,
      ...blocks.flatMap((block) => block.references),
    ]),
  };
}

/**
 * Emits every wire module and validates that each referenced type or scalar
 * is declared somewhere in the registry — a dangling reference would build a
 * schema the server cannot serve.
 */
export function emitWireModules(modules: readonly WireModule[]): EmittedModule[] {
  const emitted = modules.map((module) => emitWireModule(module));

  const declared = new Set<string>();
  for (const module of modules) {
    for (const name of Object.keys(module.enums ?? {})) declared.add(name);
    for (const name of Object.keys(module.outputTypes ?? {})) declared.add(name);
    for (const scalar of module.scalars ?? []) declared.add(scalar);
  }
  for (const { referenced } of emitted) {
    for (const name of referenced) {
      if (!declared.has(name)) {
        throw new SdlEmitError(
          `'${name}' is served by the wire registry but declared nowhere — register the type or the scalar`,
        );
      }
    }
  }

  return emitted;
}
