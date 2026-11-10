import { z } from "astro/zod";
import type { AstroIntegration } from "astro";

export interface CollectionContract<
  Id extends string = string,
  Schema extends z.ZodType = z.ZodType,
> {
  readonly id: Id;
  readonly schema: Schema;
}

interface Selector<Locations extends PropertyKey> {
  readonly locations: readonly Locations[];
}

interface Instead<Contracts> {
  readonly contracts: Contracts;
}

export interface ContentDiagnostic {
  readonly cause?: unknown;
  readonly code: "content.invalid-value" | "content.rejected-promise";
  readonly collectionId: string;
  readonly location: string;
  readonly message: string;
  readonly origin: DiagnosticOrigin;
  readonly stack: string;
}

export type DiagnosticOrigin =
  | { readonly kind: "catch" }
  | { readonly kind: "selection"; readonly location: string };

interface DiagnosticState {
  diagnostics: ContentDiagnostic[];
}

const diagnosticStateKey = Symbol.for("crush/diagnostics");

function diagnosticState(): DiagnosticState {
  const buildProcess = process as unknown as Record<PropertyKey, unknown>;
  const existing = buildProcess[diagnosticStateKey];

  if (existing) {
    return existing as DiagnosticState;
  }

  const state: DiagnosticState = { diagnostics: [] };
  buildProcess[diagnosticStateKey] = state;
  return state;
}

class ContentDiagnosticError extends Error {
  readonly code: ContentDiagnostic["code"];
  readonly collectionId: string;
  readonly location: string;
  readonly origin: DiagnosticOrigin;

  constructor(diagnostic: ContentDiagnostic) {
    super(diagnostic.message, { cause: diagnostic.cause });
    this.name = "ContentDiagnosticError";
    this.code = diagnostic.code;
    this.collectionId = diagnostic.collectionId;
    this.location = diagnostic.location;
    this.origin = diagnostic.origin;
    this.stack = diagnostic.stack;
  }
}

type ContractOutput<Contract> =
  Contract extends CollectionContract<string, infer Schema>
    ? z.output<Schema>
    : never;

type SettledValue<Value> =
  Value extends PromiseFulfilledResult<infer Fulfilled>
    ? Fulfilled
    : Value extends PromiseRejectedResult
      ? never
      : Value;

type RecoveredValue<Value, Matcher extends z.ZodType, Contract> = [
  Exclude<SettledValue<Value>, z.input<Matcher>>,
] extends [ContractOutput<Contract>]
  ? ContractOutput<Contract>
  : [ContractOutput<Contract>] extends [
        Exclude<SettledValue<Value>, z.input<Matcher>>,
      ]
    ? Exclude<SettledValue<Value>, z.input<Matcher>>
    : | Exclude<SettledValue<Value>, z.input<Matcher>>
      | ContractOutput<Contract>;

type TupleLocation<Key> = Key extends `${infer Location extends number}`
  ? Location
  : never;

type ContainerLocation<Input> = Input extends readonly unknown[]
  ? number extends Input["length"]
    ? number
    : TupleLocation<Exclude<keyof Input, keyof []>>
  : Input extends Record<PropertyKey, unknown>
    ? keyof Input
    : never;

type RecoveredArray<
  Input extends readonly unknown[],
  Matcher extends z.ZodType,
  Contracts,
> = (Input extends unknown[]
  ? Array<SettledValue<Input[number]>>
  : ReadonlyArray<SettledValue<Input[number]>>) & {
  [Location in Extract<keyof Contracts, number>]: RecoveredValue<
    Input[number],
    Matcher,
    Contracts[Location]
  >;
};

type RecoveredContainer<
  Input,
  Matcher extends z.ZodType,
  Contracts,
> = Input extends readonly unknown[]
  ? number extends Input["length"]
    ? RecoveredArray<Input, Matcher, Contracts>
    : {
        [Key in keyof Input]: TupleLocation<Key> extends keyof Contracts
          ? RecoveredValue<Input[Key], Matcher, Contracts[TupleLocation<Key>]>
          : SettledValue<Input[Key]>;
      }
  : Input extends Record<PropertyKey, unknown>
    ? {
        [Key in keyof Input]: Key extends keyof Contracts
          ? RecoveredValue<Input[Key], Matcher, Contracts[Key]>
          : SettledValue<Input[Key]>;
      }
    : never;

export function at<const Locations extends readonly PropertyKey[]>(
  ...locations: Locations
): Selector<Locations[number]> {
  return { locations };
}

export function instead<const Contracts>(
  contracts: Contracts,
): Instead<Contracts> {
  return { contracts };
}

export function on<Contract extends CollectionContract>(contract: Contract) {
  return (cause: unknown): ContractOutput<Contract> =>
    recoverRejected(contract, cause, { kind: "catch" });
}

function formatLocation(location: PropertyKey): string {
  return typeof location === "number" ? `[${location}]` : String(location);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

function recordDiagnostic(options: {
  readonly cause?: unknown;
  readonly code: ContentDiagnostic["code"];
  readonly contract: CollectionContract;
  readonly origin:
    | { readonly kind: "catch" }
    | { readonly kind: "selection"; readonly location: PropertyKey };
  readonly value?: unknown;
}): void {
  const origin: DiagnosticOrigin =
    options.origin.kind === "catch"
      ? { kind: "catch" }
      : {
          kind: "selection",
          location: formatLocation(options.origin.location),
        };
  const location = origin.kind === "catch" ? "catch" : origin.location;
  const detail =
    options.code === "content.rejected-promise"
      ? `promise rejected instead of ${options.contract.id}: ${describeCause(options.cause)}`
      : `received ${describeValue(options.value)} instead of ${options.contract.id}`;
  const message = `[${options.code}] ${options.contract.id} at ${location}: ${detail}`;
  const stack = new Error(message).stack ?? message;

  diagnosticState().diagnostics.push({
    cause: options.cause,
    code: options.code,
    collectionId: options.contract.id,
    location,
    message,
    origin,
    stack,
  });
}

function recoverRejected<Contract extends CollectionContract>(
  contract: Contract,
  cause: unknown,
  origin:
    | { readonly kind: "catch" }
    | { readonly kind: "selection"; readonly location: PropertyKey },
): ContractOutput<Contract> {
  const recovered = contract.schema.parse(
    undefined,
  ) as ContractOutput<Contract>;
  recordDiagnostic({
    cause,
    code: "content.rejected-promise",
    contract,
    origin,
  });
  return recovered;
}

function compareDiagnostics(
  left: ContentDiagnostic,
  right: ContentDiagnostic,
): number {
  return (
    left.location.localeCompare(right.location) ||
    left.collectionId.localeCompare(right.collectionId) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message) ||
    left.stack.localeCompare(right.stack)
  );
}

function resetDiagnostics(): void {
  diagnosticState().diagnostics = [];
}

function failForDiagnostics(options: {
  readonly logger: { error(message: string): void };
}): void {
  const diagnostics = [...diagnosticState().diagnostics].sort(
    compareDiagnostics,
  );

  if (diagnostics.length === 0) return;

  const report = diagnostics
    .map((diagnostic) => diagnostic.message)
    .join("\n");
  const aggregateMessage = `Static build failed with ${diagnostics.length} content diagnostics:\n${report}`;
  const errors = diagnostics.map(
    (diagnostic) => new ContentDiagnosticError(diagnostic),
  );
  errors[0].message = aggregateMessage;
  options.logger.error(
    diagnostics
      .map((diagnostic) => `${diagnostic.message}\n${diagnostic.stack}`)
      .join("\n\n"),
  );
  throw new AggregateError(errors, aggregateMessage);
}

export function integration(): AstroIntegration {
  return {
    hooks: {
      "astro:build:done": failForDiagnostics,
      "astro:build:start": resetDiagnostics,
    },
    name: "crush",
  };
}

function isSettledResult(
  value: unknown,
): value is PromiseSettledResult<unknown> {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  return value.status === "fulfilled" || value.status === "rejected";
}

function crushIf<Locations extends PropertyKey>(
  selector: Selector<Locations>,
) {
  return {
    is<
      Matcher extends z.ZodType,
      Contracts extends Record<Locations, CollectionContract>,
    >(matcher: Matcher, replacement: Instead<Contracts>) {
      return <Input extends readonly unknown[] | Record<PropertyKey, unknown>>(
        input: Exclude<Locations, ContainerLocation<Input>> extends never
          ? Input
          : never,
      ): RecoveredContainer<Input, Matcher, Contracts> => {
        for (const location of selector.locations) {
          if (!Object.hasOwn(input, location)) {
            throw new Error(
              `Selected location ${JSON.stringify(String(location))} is not present in the input`,
            );
          }
        }

        const output = Array.isArray(input) ? [...input] : { ...input };
        const inputValues = Object.values(input);
        const settledInput =
          inputValues.length > 0 && inputValues.every(isSettledResult);

        if (settledInput) {
          for (const key of Reflect.ownKeys(output)) {
            const result = output[key as keyof typeof output];

            if (isSettledResult(result) && result.status === "fulfilled") {
              output[key as keyof typeof output] =
                result.value as (typeof output)[keyof typeof output];
            }
          }
        }

        for (const location of selector.locations) {
          const original = input[location as keyof Input];
          const contract = replacement.contracts[location];

          if (
            settledInput &&
            isSettledResult(original) &&
            original.status === "rejected"
          ) {
            output[location as keyof typeof output] = recoverRejected(
              contract,
              original.reason,
              { kind: "selection", location },
            ) as (typeof output)[keyof typeof output];
            continue;
          }

          const value = output[location as keyof typeof output];

          if (matcher.safeParse(value).success) {
            const recovered = contract.schema.parse(
              value,
            ) as (typeof output)[keyof typeof output];
            recordDiagnostic({
              code: "content.invalid-value",
              contract,
              origin: { kind: "selection", location },
              value,
            });
            output[location as keyof typeof output] = recovered;
          }
        }

        if (settledInput) {
          for (const value of Object.values(output)) {
            if (isSettledResult(value) && value.status === "rejected") {
              throw value.reason;
            }
          }
        }

        return output as RecoveredContainer<Input, Matcher, Contracts>;
      };
    },
  };
}

export { crushIf as if };
