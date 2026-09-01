"use client";

/**
 * Browser half of Paperboat ENV Injection profile 1.
 *
 * This module intentionally has no server-side counterpart. Values are only
 * ever handled in this browser process, and private keys are held as
 * non-extractable CryptoKeys in IndexedDB. The BFF receives only the signed
 * ciphertext envelope produced by `mutateEnvironmentManifest`.
 */

import {
  Aes256Gcm,
  CipherSuite,
  DhkemX25519HkdfSha256,
  HkdfSha256,
} from "@hpke/core";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export const ENV_AUTHORITY_CONTENT_TYPE = "application/paperboat.environment.authority+cbor;v=1";
export const ENV_BINDING_CONTENT_TYPE = "application/paperboat.environment.key-binding+cbor;v=1";
export const ENV_MANIFEST_CONTENT_TYPE = "application/paperboat.environment.scope-manifest+cbor;v=1";
export const ENV_MAX_MANIFEST_BYTES = 1 << 20;
export const ENV_MAX_AUTHORITY_BYTES = 2 << 20;
export const ENV_MAX_BINDING_BYTES = 2 << 10;
export const ENV_MAX_VARIABLES = 128;
export const ENV_MAX_NAME_BYTES = 128;
export const ENV_MAX_VALUE_BYTES = 32_767;
export const ENV_MAX_PLAINTEXT_BYTES = 256 * 1024;
export const ENV_MAX_BROWSER_INTEGER = Number.MAX_SAFE_INTEGER;
export const ENV_CIPHERTEXT_BUCKETS = [1024, 4096, 16384, 65536, 262144, 524288] as const;

type CborPrimitive = null | boolean | number | string | Uint8Array;
export type CborValue = CborPrimitive | CborValue[] | Map<CborValue, CborValue> | CborTag;

export interface CborTag {
  tag: number;
  value: CborValue;
}

export interface EnvironmentBinding {
  id: string;
  raw: Uint8Array;
  accountId: string;
  subjectKind: 1 | 2 | 3 | 4;
  subjectId: string;
  subjectGeneration: number;
  keyGeneration: number;
  endpointCertificate: Uint8Array | null;
  signingPublicKey: Uint8Array | null;
  signingKeyId: string | null;
  recipientPublicKey: Uint8Array;
  recipientKeyId: string;
  notBefore: number;
  serial: number;
}

export interface EnvironmentAuthority {
  id: string;
  raw: Uint8Array;
  accountId: string;
  generation: number;
  previousId: string | null;
  operationId: string;
  bindings: EnvironmentBinding[];
  resetScopes: Array<{ scope: "global" | "machine"; machineId?: string }>;
  signerKeyId: string;
}

export interface EnvironmentRecipientWrap {
  kind: 1 | 2 | 3;
  subjectId: string;
  keyGeneration: number;
  keyId: string;
  encapsulatedKey: Uint8Array;
  wrappedScopeKey: Uint8Array;
}

export interface EnvironmentManifest {
  id: string;
  raw: Uint8Array;
  signerKeyId: string;
  accountId: string;
  authorityGeneration: number;
  authorityId: string;
  scope: "global" | "machine";
  machineId: string | null;
  scopeState: "active" | "retired";
  previousVersion: number;
  version: number;
  keyEpoch: number;
  operationId: string;
  mutationKind: 0 | 1 | 2 | 3 | 4 | 5;
  changedNames: string[];
  names: string[];
  ciphertextDigest: Uint8Array;
  ciphertext: Uint8Array;
  wraps: EnvironmentRecipientWrap[];
}

export interface EnvironmentVariableValue {
  name: string;
  value: string;
}

export interface EnvironmentManagerKeyRecord {
  subjectId: string;
  subjectGeneration: number;
  keyGeneration: number;
  recipientKeyId: string;
  recipientPublicKey: Uint8Array;
  recipientPrivateKey: CryptoKey;
  signingKeyId: string;
  signingPublicKey: Uint8Array;
  signingPrivateKey: CryptoKey;
  /** Public root material is trust data, never a decryption capability. */
  rootPublicKey?: Uint8Array;
}

/**
 * Browser-only durable trust state. It contains public trust metadata and an
 * enrollment journal only. It deliberately never contains a scope key or an
 * environment value.
 */
export interface EnvironmentAuthorityCheckpoint {
  accountId: string;
  rootKeyId: string;
  generation: number;
  authorityId: string;
}

export interface EnvironmentEnrollmentJournal {
  accountId: string;
  operationId: string;
  subjectId: string;
  subjectGeneration: number;
  keyGeneration: number;
  requestId?: string;
  requestExpiresAt: string;
  canonical: Uint8Array;
  digest: Uint8Array;
  safetyCode: string;
  requestBody: Record<string, unknown>;
  state: "created" | "challenge" | "pending";
}

export type EnvironmentManagerStatus =
  | { enrolled: false; reason: "storage_unavailable" | "local_key_missing" | "authority_unavailable" | "binding_missing" | "root_unavailable" }
  | { enrolled: true; reason: "ready"; record: EnvironmentManagerKeyRecord; authority: EnvironmentAuthority; binding: EnvironmentBinding };

export interface EnvironmentManifestMutationInput {
  authority: EnvironmentAuthority;
  current: EnvironmentManifest | null;
  record: EnvironmentManagerKeyRecord;
  scope: "global" | "machine";
  machineId?: string;
  operationId: string;
  value?: EnvironmentVariableValue;
  unsetName?: string;
}

const DB_NAME = "paperboat-environment-e2ee-v1";
const DB_VERSION = 2;
const KEY_STORE = "manager-keys";
const STATE_STORE = "manager-state";
const MANAGER_KEY_ID = "manager";
const MANAGER_STATE_ID = "state";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OPERATION_ID = /^envop_[0-9a-f]{32}$/;
const KEY_ID = /^(?:sigk|envk)_[A-Za-z0-9_-]{43}$/;
const DIGEST_ID = /^sha256:[0-9a-f]{64}$/;
const RESERVED_PREFIXES = ["PAPERBOAT_", "LD_", "DYLD_"];
const RESERVED_NAMES = new Set(["NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "GOTRACEBACK"]);

const ENROLLMENT_REQUEST_SCHEMA = "paperboat.environment.enrollment-request";
const ENROLLMENT_REQUEST_VERSION = 1;
const ENROLLMENT_REQUEST_SIGNATURE_SCHEMA = "paperboat.environment.enrollment-request-signature";
const ENROLLMENT_PROOF_SCHEMA = "paperboat.environment.enrollment-proof";
const ENROLLMENT_CHALLENGE_INFO_SCHEMA = "paperboat.environment.enrollment-challenge-info";
const ENROLLMENT_CHALLENGE_AAD_SCHEMA = "paperboat.environment.enrollment-challenge-aad";
const ENROLLMENT_SAFETY_CODE_SCHEMA = "paperboat.environment.enrollment-safety-code";

const hpkeSuite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Aes256Gcm(),
});

function asBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function cloneBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  return new Uint8Array(asBytes(value));
}

function cryptoBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  const source = asBytes(value);
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);
  return copy;
}

function equalBytes(left: ArrayBuffer | ArrayBufferView, right: ArrayBuffer | ArrayBufferView): boolean {
  const a = asBytes(left);
  const b = asBytes(right);
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function requireInteger(value: number, field = "integer"): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > ENV_MAX_BROWSER_INTEGER) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function encodeLength(major: number, length: number): Uint8Array {
  requireInteger(length, "length");
  if (length < 24) return Uint8Array.of((major << 5) | length);
  if (length < 256) return Uint8Array.of((major << 5) | 24, length);
  if (length < 65_536) return Uint8Array.of((major << 5) | 25, length >>> 8, length & 0xff);
  if (length < 4_294_967_296) return Uint8Array.of(
    (major << 5) | 26,
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  );
  const high = Math.floor(length / 2 ** 32);
  const low = length >>> 0;
  return Uint8Array.of(
    (major << 5) | 27,
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
  );
}

function joinBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function encodeCborValue(value: CborValue): Uint8Array {
  if (value === null) return Uint8Array.of(0xf6);
  if (typeof value === "boolean") return Uint8Array.of(value ? 0xf5 : 0xf4);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < -ENV_MAX_BROWSER_INTEGER || value > ENV_MAX_BROWSER_INTEGER) {
      throw new Error("CBOR only permits safe integer values in ENV documents.");
    }
    if (value >= 0) return encodeLength(0, value);
    return encodeLength(1, -1 - value);
  }
  if (typeof value === "string") {
    const bytes = textEncoder.encode(value);
    return joinBytes([encodeLength(3, bytes.length), bytes]);
  }
  if (value instanceof Uint8Array) {
    return joinBytes([encodeLength(2, value.length), value]);
  }
  if (Array.isArray(value)) {
    return joinBytes([encodeLength(4, value.length), ...value.map(encodeCborValue)]);
  }
  if (value instanceof Map) {
    const encoded = [...value.entries()].map(([key, child]) => ({ key: encodeCborValue(key), child: encodeCborValue(child) }));
    encoded.sort((left, right) => compareBytes(left.key, right.key));
    for (let index = 1; index < encoded.length; index += 1) {
      if (equalBytes(encoded[index - 1].key, encoded[index].key)) throw new Error("CBOR map keys must be unique.");
    }
    return joinBytes([encodeLength(5, encoded.length), ...encoded.flatMap(({ key, child }) => [key, child])]);
  }
  const tag = value as CborTag;
  if (!Number.isSafeInteger(tag.tag) || tag.tag < 0) throw new Error("Invalid CBOR tag.");
  return joinBytes([encodeLength(6, tag.tag), encodeCborValue(tag.value)]);
}

/** RFC 8949 deterministic CBOR encoder used by every signed/AEAD structure. */
export function encodeEnvironmentCbor(value: CborValue): Uint8Array {
  return encodeCborValue(value);
}

interface DecodeCursor { bytes: Uint8Array; offset: number; depth: number; }

function readLength(cursor: DecodeCursor, additional: number): number {
  if (additional < 24) return additional;
  const count = additional === 24 ? 1 : additional === 25 ? 2 : additional === 26 ? 4 : additional === 27 ? 8 : 0;
  if (count === 0 || cursor.offset + count > cursor.bytes.length) throw new Error("Indefinite or truncated CBOR is invalid.");
  let value = 0;
  for (let index = 0; index < count; index += 1) {
    value = value * 256 + cursor.bytes[cursor.offset + index];
    if (value > ENV_MAX_BROWSER_INTEGER) throw new Error("CBOR integer exceeds browser precision.");
  }
  cursor.offset += count;
  if (value < 24 && additional >= 24 || count === 2 && value < 256 || count === 4 && value < 65_536 || count === 8 && value < 4_294_967_296) {
    throw new Error("CBOR integer is not minimally encoded.");
  }
  return value;
}

function decodeCborValue(cursor: DecodeCursor): CborValue {
  if (cursor.depth++ > 16) throw new Error("CBOR nesting limit exceeded.");
  try {
    if (cursor.offset >= cursor.bytes.length) throw new Error("Truncated CBOR.");
    const initial = cursor.bytes[cursor.offset++];
    const major = initial >>> 5;
    const additional = initial & 31;
    if (additional === 31) throw new Error("Indefinite-length CBOR is invalid.");
    if (major === 0) return readLength(cursor, additional);
    if (major === 1) {
      const value = readLength(cursor, additional);
      if (value >= ENV_MAX_BROWSER_INTEGER) throw new Error("Negative CBOR integer exceeds browser precision.");
      return -1 - value;
    }
    if (major === 2 || major === 3) {
      const length = readLength(cursor, additional);
      if (length > cursor.bytes.length - cursor.offset) throw new Error("Truncated CBOR bytes.");
      const raw = cursor.bytes.slice(cursor.offset, cursor.offset + length);
      cursor.offset += length;
      if (major === 2) return raw;
      return textDecoder.decode(raw);
    }
    if (major === 4) {
      const length = readLength(cursor, additional);
      if (length > 2048) throw new Error("CBOR array is too large.");
      return Array.from({ length }, () => decodeCborValue(cursor));
    }
    if (major === 5) {
      const length = readLength(cursor, additional);
      if (length > 64) throw new Error("CBOR map is too large.");
      const map = new Map<CborValue, CborValue>();
      let previousKey: Uint8Array | undefined;
      for (let index = 0; index < length; index += 1) {
        const start = cursor.offset;
        const key = decodeCborValue(cursor);
        const encodedKey = cursor.bytes.slice(start, cursor.offset);
        if (previousKey && compareBytes(previousKey, encodedKey) >= 0) throw new Error("CBOR map keys are not canonical.");
        previousKey = encodedKey;
        if ([...map.keys()].some((existing) => equalBytes(encodeCborValue(existing), encodedKey))) throw new Error("CBOR map keys are duplicated.");
        map.set(key, decodeCborValue(cursor));
      }
      return map;
    }
    if (major === 6) {
      const tag = readLength(cursor, additional);
      return { tag, value: decodeCborValue(cursor) };
    }
    if (major === 7 && additional === 20) return false;
    if (major === 7 && additional === 21) return true;
    if (major === 7 && additional === 22) return null;
    throw new Error("Floating-point and unsupported CBOR values are invalid.");
  } finally {
    cursor.depth -= 1;
  }
}

/** Strict decoder with canonical round-trip validation and no trailing bytes. */
export function decodeEnvironmentCbor(raw: ArrayBuffer | ArrayBufferView): CborValue {
  const bytes = cloneBytes(raw);
  const cursor: DecodeCursor = { bytes, offset: 0, depth: 0 };
  const value = decodeCborValue(cursor);
  if (cursor.offset !== bytes.length || !equalBytes(encodeCborValue(value), bytes)) throw new Error("CBOR must be canonical and complete.");
  return value;
}

function expectArray(value: CborValue, length: number, field: string): CborValue[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`Invalid ${field}.`);
  return value;
}

function expectString(value: CborValue, field: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${field}.`);
  return value;
}

function expectBytes(value: CborValue, length: number | undefined, field: string): Uint8Array {
  if (!(value instanceof Uint8Array) || length !== undefined && value.length !== length) throw new Error(`Invalid ${field}.`);
  return cloneBytes(value);
}

function expectInteger(value: CborValue, field: string): number {
  if (typeof value !== "number") throw new Error(`Invalid ${field}.`);
  return requireInteger(value, field);
}

function expectNullableBytes(value: CborValue, field: string): Uint8Array | null {
  return value === null ? null : expectBytes(value, undefined, field);
}

function expectNullableString(value: CborValue, field: string): string | null {
  return value === null ? null : expectString(value, field);
}

function validateIdentifier(value: string, field: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`Invalid ${field}.`);
  return value;
}

function validateOperationId(value: string): string {
  if (!OPERATION_ID.test(value)) throw new Error("Invalid environment operation ID.");
  return value;
}

interface BrowserEnrollmentRequest {
  accountId: string;
  operationId: string;
  subjectKind: 2;
  subjectId: string;
  subjectGeneration: number;
  keyGeneration: number;
  signingPublicKey: Uint8Array;
  signingKeyId: string;
  recipientPublicKey: Uint8Array;
  recipientKeyId: string;
  expiresAtSeconds: number;
}

/** Parse the exact canonical request that the Go enrollment verifier signs. */
async function parseBrowserEnrollmentRequest(raw: Uint8Array): Promise<BrowserEnrollmentRequest> {
  const fields = expectArray(decodeEnvironmentCbor(raw), 15, "browser enrollment request");
  const domain = expectString(fields[0], "enrollment request domain");
  const version = expectInteger(fields[1], "enrollment request version");
  const accountId = validateIdentifier(expectString(fields[2], "enrollment account"), "enrollment account");
  const operation = expectBytes(fields[3], 16, "enrollment operation ID");
  const subjectKind = expectInteger(fields[4], "enrollment subject kind");
  const subjectId = validateIdentifier(expectString(fields[5], "enrollment subject ID"), "enrollment subject ID");
  const subjectGeneration = expectInteger(fields[6], "enrollment subject generation");
  const keyGeneration = expectInteger(fields[7], "enrollment key generation");
  const endpointCertificate = fields[8];
  const signingPublicKey = expectBytes(fields[9], 32, "enrollment signing public key");
  const signingKeyId = expectString(fields[10], "enrollment signing key ID");
  const recipientPublicKey = expectBytes(fields[11], 32, "enrollment recipient public key");
  const recipientKeyId = expectString(fields[12], "enrollment recipient key ID");
  const bindingNotAfter = fields[13];
  const expiresAtSeconds = expectInteger(fields[14], "enrollment expiry");
  if (operation.every((byte) => byte === 0)) throw new Error("Invalid enrollment operation ID.");
  if (
    domain !== ENROLLMENT_REQUEST_SCHEMA ||
    version !== ENROLLMENT_REQUEST_VERSION ||
    subjectKind !== 2 ||
    subjectGeneration < 1 ||
    keyGeneration < 1 ||
    endpointCertificate !== null ||
    bindingNotAfter !== null ||
    expiresAtSeconds < 1
  ) throw new Error("Invalid browser enrollment request.");
  validateKeyId(signingKeyId, "sigk_");
  validateKeyId(recipientKeyId, "envk_");
  if (signingKeyId !== await environmentKeyId("Ed25519", signingPublicKey)) throw new Error("Enrollment signing key ID does not match key.");
  if (recipientKeyId !== await environmentKeyId("X25519", recipientPublicKey)) throw new Error("Enrollment recipient key ID does not match key.");
  return {
    accountId,
    operationId: operationId(operation),
    subjectKind: 2,
    subjectId,
    subjectGeneration,
    keyGeneration,
    signingPublicKey,
    signingKeyId,
    recipientPublicKey,
    recipientKeyId,
    expiresAtSeconds,
  };
}

function operationId(bytes: Uint8Array): string {
  return `envop_${[...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function operationBytes(value: string): Uint8Array {
  validateOperationId(value);
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) bytes[index] = Number.parseInt(value.slice(6 + index * 2, 8 + index * 2), 16);
  return bytes;
}

function digestId(bytes: Uint8Array): string {
  return `sha256:${[...bytes].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256(value: ArrayBuffer | ArrayBufferView): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", cryptoBytes(value)));
}

function base64UrlEncode(value: ArrayBuffer | ArrayBufferView): string {
  const bytes = asBytes(value);
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Canonical unpadded base64url for public E2EE proofs and envelopes. */
export function encodeEnvironmentBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  return base64UrlEncode(value);
}

function base64UrlDecode(value: string, max: number, field: string): Uint8Array {
  if (!value || value.includes("=") || /[^A-Za-z0-9_-]/.test(value) || value.length > Math.ceil(max * 4 / 3) + 4) throw new Error(`Invalid ${field}.`);
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary: string;
  try { binary = atob(padded); } catch { throw new Error(`Invalid ${field}.`); }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytes.length === 0 || bytes.length > max || base64UrlEncode(bytes) !== value) throw new Error(`Invalid ${field}.`);
  return bytes;
}

export async function environmentKeyId(kind: "X25519" | "Ed25519", publicKey: ArrayBuffer | ArrayBufferView): Promise<string> {
  const jwk = `{"crv":"${kind}","kty":"OKP","x":"${base64UrlEncode(publicKey)}"}`;
  return `${kind === "X25519" ? "envk_" : "sigk_"}${base64UrlEncode(await sha256(textEncoder.encode(jwk)))}`;
}

export async function environmentRootKeyId(publicKey: Uint8Array): Promise<string> {
  return `aek_${[...(await sha256(publicKey))].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function validateKeyId(value: string, prefix: "envk_" | "sigk_") {
  if (!KEY_ID.test(value) || !value.startsWith(prefix)) throw new Error("Invalid environment key ID.");
}

function validateVariableName(value: string): string {
  if (!VARIABLE_NAME.test(value) || textEncoder.encode(value).length > ENV_MAX_NAME_BYTES) throw new Error("Invalid environment variable name.");
  const folded = value.toUpperCase();
  if (RESERVED_PREFIXES.some((prefix) => folded.startsWith(prefix)) || RESERVED_NAMES.has(folded)) throw new Error("Reserved environment variable name.");
  return value;
}

/** Typed ordering key shared with the server's persisted scope references. */
export function environmentScopeRefKey(scope: "global" | "machine", machineId?: string): string {
  if (scope === "global") {
    if (machineId !== undefined) throw new Error("Global scope cannot have a machine ID.");
    return "g";
  }
  if (!machineId || !IDENTIFIER.test(machineId)) throw new Error("A valid machine ID is required.");
  return `m:${machineId}`;
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function sortedNames(values: string[], field: string): string[] {
  const copy = [...values];
  for (let index = 0; index < copy.length; index += 1) {
    validateVariableName(copy[index]);
    if (index > 0 && copy[index - 1] >= copy[index]) throw new Error(`Invalid ${field}.`);
  }
  return copy;
}

function validateCiphertextLength(length: number): boolean {
  return ENV_CIPHERTEXT_BUCKETS.some((bucket) => length === bucket + 16);
}

interface CoseDocument { payload: Uint8Array; signerKeyId: string; protectedBytes: Uint8Array; }

async function verifyCose(raw: Uint8Array, contentType: string, keys: Map<string, Uint8Array>, signerPrefix: "aek_" | "sigk_"): Promise<CoseDocument> {
  const decoded = decodeEnvironmentCbor(raw);
  const tag = decoded as CborTag;
  if (!tag || tag.tag !== 18) throw new Error("Invalid COSE envelope.");
  const parts = expectArray(tag.value, 4, "COSE envelope");
  const protectedBytes = expectBytes(parts[0], undefined, "COSE protected header");
  if (!equalBytes(encodeEnvironmentCbor(decodeEnvironmentCbor(protectedBytes)), protectedBytes)) throw new Error("Protected header is not canonical.");
  const unprotected = parts[1];
  if (!(unprotected instanceof Map) || unprotected.size !== 0) throw new Error("COSE unprotected header must be empty.");
  const payload = expectBytes(parts[2], undefined, "COSE payload");
  if (!equalBytes(encodeEnvironmentCbor(decodeEnvironmentCbor(payload)), payload)) throw new Error("COSE payload is not canonical.");
  const signature = expectBytes(parts[3], 64, "COSE signature");
  const protectedHeader = decodeEnvironmentCbor(protectedBytes);
  if (!(protectedHeader instanceof Map) || protectedHeader.size !== 3) throw new Error("Invalid COSE protected header.");
  const algorithm = protectedHeader.get(1);
  const type = protectedHeader.get(3);
  const keyBytes = protectedHeader.get(4);
  if (algorithm !== -8 || type !== contentType) throw new Error("Invalid COSE protected header.");
  const signerKeyId = new TextDecoder().decode(expectBytes(keyBytes ?? null, undefined, "COSE signer key ID"));
  if (signerPrefix === "sigk_") validateKeyId(signerKeyId, "sigk_");
  else if (!/^aek_[0-9a-f]{64}$/.test(signerKeyId)) throw new Error("Invalid root signer key ID.");
  const publicKey = keys.get(signerKeyId);
  if (!publicKey) throw new Error("COSE signer is not trusted.");
  const verifyKey = await crypto.subtle.importKey("raw", cryptoBytes(publicKey), { name: "Ed25519" }, false, ["verify"]);
  const signingInput = encodeEnvironmentCbor(["Signature1", protectedBytes, new Uint8Array(), payload]);
  if (!await crypto.subtle.verify("Ed25519", verifyKey, cryptoBytes(signature), cryptoBytes(signingInput))) throw new Error("COSE signature is invalid.");
  return { payload, signerKeyId, protectedBytes };
}

async function parseBinding(raw: Uint8Array, rootPublicKey: Uint8Array): Promise<EnvironmentBinding> {
  if (raw.length === 0 || raw.length > ENV_MAX_BINDING_BYTES) throw new Error("Invalid environment binding size.");
  const roots = new Map([[await environmentRootKeyId(rootPublicKey), rootPublicKey]]);
  const cose = await verifyCose(raw, ENV_BINDING_CONTENT_TYPE, roots, "aek_");
  const fields = expectArray(decodeEnvironmentCbor(cose.payload), 15, "environment binding");
  const domain = expectString(fields[0], "binding domain");
  const version = expectInteger(fields[1], "binding version");
  const accountId = validateIdentifier(expectString(fields[2], "binding account"), "binding account");
  const subjectKind = expectInteger(fields[3], "binding subject kind");
  if (domain !== "paperboat.environment.key-binding" || version !== 1 || ![1, 2, 3, 4].includes(subjectKind)) throw new Error("Invalid environment binding.");
  const subjectId = validateIdentifier(expectString(fields[4], "binding subject ID"), "binding subject ID");
  const subjectGeneration = expectInteger(fields[5], "binding subject generation");
  const keyGeneration = expectInteger(fields[6], "binding key generation");
  if (subjectGeneration < 1 || keyGeneration < 1) throw new Error("Invalid environment binding generation.");
  const endpointCertificate = expectNullableBytes(fields[7], "binding endpoint certificate");
  const signingPublicKey = expectNullableBytes(fields[8], "binding signing key");
  const signingKeyId = expectNullableString(fields[9], "binding signing key ID");
  const recipientPublicKey = expectBytes(fields[10], 32, "binding recipient key");
  const recipientKeyId = expectString(fields[11], "binding recipient key ID");
  validateKeyId(recipientKeyId, "envk_");
  if (recipientKeyId !== await environmentKeyId("X25519", recipientPublicKey)) throw new Error("Environment recipient key ID does not match key.");
  const notBefore = expectInteger(fields[12], "binding not-before");
  if (notBefore < 1 || fields[13] !== null) throw new Error("Profile 1 bindings require a null not-after.");
  const serial = expectInteger(fields[14], "binding serial");
  if (serial < 1) throw new Error("Invalid binding serial.");
  const manager = subjectKind === 1 || subjectKind === 2;
  if (manager) {
    if (!signingPublicKey || signingPublicKey.length !== 32 || !signingKeyId || signingKeyId !== await environmentKeyId("Ed25519", signingPublicKey)) throw new Error("Invalid manager binding keys.");
  } else if (signingPublicKey !== null || signingKeyId !== null) {
    throw new Error("Invalid non-manager binding keys.");
  }
  if (subjectKind === 4 && subjectId !== "environment_recovery") throw new Error("Invalid recovery binding subject.");
  if ((subjectKind === 1 || subjectKind === 3) !== Boolean(endpointCertificate) || (subjectKind === 2 || subjectKind === 4) && endpointCertificate !== null) throw new Error("Invalid binding endpoint certificate.");
  return { id: digestId(await sha256(raw)), raw: cloneBytes(raw), accountId, subjectKind: subjectKind as 1 | 2 | 3 | 4, subjectId, subjectGeneration, keyGeneration, endpointCertificate, signingPublicKey, signingKeyId, recipientPublicKey, recipientKeyId, notBefore, serial };
}

/** Verify and parse the root-signed authority document received from the server. */
export async function parseEnvironmentAuthority(rawInput: ArrayBuffer | ArrayBufferView, rootPublicKeyInput: ArrayBuffer | ArrayBufferView): Promise<EnvironmentAuthority> {
  const raw = cloneBytes(rawInput);
  const rootPublicKey = cloneBytes(rootPublicKeyInput);
  if (raw.length === 0 || raw.length > ENV_MAX_AUTHORITY_BYTES || rootPublicKey.length !== 32) throw new Error("Invalid environment authority.");
  const roots = new Map([[await environmentRootKeyId(rootPublicKey), rootPublicKey]]);
  const cose = await verifyCose(raw, ENV_AUTHORITY_CONTENT_TYPE, roots, "aek_");
  const fields = expectArray(decodeEnvironmentCbor(cose.payload), 8, "environment authority");
  const domain = expectString(fields[0], "authority domain");
  const version = expectInteger(fields[1], "authority version");
  const accountId = validateIdentifier(expectString(fields[2], "authority account"), "authority account");
  const generation = expectInteger(fields[3], "authority generation");
  const previous = fields[4] === null ? null : expectBytes(fields[4], 32, "authority previous ID");
  const operation = expectBytes(fields[5], 16, "authority operation ID");
  const bindingValues = fields[6];
  const resetValues = fields[7];
  if (domain !== "paperboat.environment.authority" || version !== 1 || generation < 1 || !Array.isArray(bindingValues) || !Array.isArray(resetValues) || generation === 1 && previous !== null || generation > 1 && previous === null) throw new Error("Invalid environment authority.");
  if (!Array.isArray(bindingValues) || bindingValues.length < 2 || bindingValues.length > 545) throw new Error("Invalid environment authority bindings.");
  const bindings: EnvironmentBinding[] = [];
  const subjects = new Set<string>();
  const recipients = new Set<string>();
  const signers = new Set<string>();
  let managers = 0;
  let hosts = 0;
  for (const encoded of bindingValues) {
    const binding = await parseBinding(expectBytes(encoded, undefined, "authority binding"), rootPublicKey);
    if (binding.accountId !== accountId) throw new Error("Authority binding account mismatch.");
    const subject = `${binding.subjectKind}\u0000${binding.subjectId}`;
    if (subjects.has(subject) || recipients.has(binding.recipientKeyId) || binding.signingKeyId && signers.has(binding.signingKeyId)) throw new Error("Authority bindings are duplicated.");
    subjects.add(subject); recipients.add(binding.recipientKeyId); if (binding.signingKeyId) signers.add(binding.signingKeyId); bindings.push(binding);
    if (binding.subjectKind === 1 || binding.subjectKind === 2) managers += 1;
    if (binding.subjectKind === 3) hosts += 1;
  }
  for (let index = 1; index < bindings.length; index += 1) {
    const previousBinding = bindings[index - 1];
    const binding = bindings[index];
    if (previousBinding.subjectKind > binding.subjectKind || previousBinding.subjectKind === binding.subjectKind && (previousBinding.subjectId > binding.subjectId || previousBinding.subjectId === binding.subjectId && (previousBinding.keyGeneration > binding.keyGeneration || previousBinding.keyGeneration === binding.keyGeneration && previousBinding.id >= binding.id))) throw new Error("Authority bindings are not sorted.");
  }
  if (bindings.filter((binding) => binding.subjectKind === 4).length !== 1 || managers < 1 || managers > 32 || hosts > 512 || bindings.find((binding) => binding.subjectKind === 4)?.subjectId !== "environment_recovery") throw new Error("Authority must contain managers and one recovery binding.");
  const resetScopes: EnvironmentAuthority["resetScopes"] = [];
  let previousScope = "";
  for (const encoded of resetValues) {
    const pair = expectArray(encoded, 2, "authority reset scope");
    const kind = expectInteger(pair[0], "authority reset scope kind");
    const machineId = expectNullableString(pair[1], "authority reset machine ID");
    if (kind !== 0 && kind !== 1 || kind === 0 && machineId !== null || kind === 1 && (!machineId || !IDENTIFIER.test(machineId))) throw new Error("Invalid authority reset scope.");
    const scope = kind === 0 ? "global" : "machine";
    // Keep the scope kind in the ordering key. A machine may legitimately be
    // named "global" and must never alias the account-wide scope.
    const key = environmentScopeRefKey(scope, machineId ?? undefined);
    if (key <= previousScope) throw new Error("Authority reset scopes are not sorted.");
    previousScope = key;
    resetScopes.push(kind === 0 ? { scope } : { scope, machineId: machineId! });
  }
  const authorityId = digestId(await sha256(raw));
  return { id: authorityId, raw, accountId, generation, previousId: previous ? digestId(previous) : null, operationId: operationId(operation), bindings, resetScopes, signerKeyId: cose.signerKeyId };
}

/**
 * Verify a sequential authority page against the browser's durable head. A
 * root signature alone is not sufficient because a control plane can replay a
 * previously valid authority document. Callers persist each returned document
 * only after this check succeeds.
 */
export async function verifyEnvironmentAuthorityChain(
  rawDocuments: Array<ArrayBuffer | ArrayBufferView>,
  rootPublicKey: Uint8Array,
  previous?: EnvironmentAuthorityCheckpoint,
  expectedAccountId?: string,
): Promise<EnvironmentAuthority | null> {
  if (rootPublicKey.length !== 32) throw new Error("Invalid environment root key.");
  const rootKeyId = await environmentRootKeyId(rootPublicKey);
  if (previous && previous.rootKeyId !== rootKeyId) throw new Error("The pinned environment root changed.");
  let generation = previous?.generation ?? 0;
  let authorityId = previous?.authorityId ?? null;
  let accountId = expectedAccountId ?? previous?.accountId;
  let last: EnvironmentAuthority | null = null;
  for (const raw of rawDocuments) {
    const authority = await parseEnvironmentAuthority(raw, rootPublicKey);
    if (accountId && authority.accountId !== accountId) throw new Error("Environment authority account mismatch.");
    accountId ??= authority.accountId;
    if (authority.generation !== generation + 1 || authority.previousId !== authorityId) throw new Error("Environment authority continuity could not be verified.");
    generation = authority.generation;
    authorityId = authority.id;
    last = authority;
  }
  return last;
}

function recipientSortKey(wrap: EnvironmentRecipientWrap): string {
  return `${wrap.kind}\u0000${wrap.subjectId}\u0000${wrap.keyGeneration.toString().padStart(20, "0")}\u0000${wrap.keyId}`;
}

function expectedRecipientKeys(scope: "global" | "machine", machineId: string | null, scopeState: "active" | "retired", bindings: EnvironmentBinding[]): string[] {
  return bindings.flatMap((binding) => {
    const kind = binding.subjectKind === 1 || binding.subjectKind === 2 ? 1 : binding.subjectKind === 3 ? 2 : 3;
    const include = kind === 1 || kind === 3 || kind === 2 && scope === "global" || kind === 2 && scope === "machine" && scopeState === "active" && binding.subjectId === machineId;
    return include ? [`${kind}\u0000${binding.subjectId}\u0000${binding.keyGeneration.toString().padStart(20, "0")}\u0000${binding.recipientKeyId}`] : [];
  }).sort();
}

/** Verify and parse a root-authorized manager-signed scope manifest. */
export async function parseEnvironmentManifest(rawInput: ArrayBuffer | ArrayBufferView, authority: EnvironmentAuthority): Promise<EnvironmentManifest> {
  const raw = cloneBytes(rawInput);
  if (raw.length === 0 || raw.length > ENV_MAX_MANIFEST_BYTES) throw new Error("Invalid environment manifest size.");
  const managerKeys = new Map<string, Uint8Array>();
  for (const binding of authority.bindings) if ((binding.subjectKind === 1 || binding.subjectKind === 2) && binding.signingKeyId && binding.signingPublicKey) managerKeys.set(binding.signingKeyId, binding.signingPublicKey);
  const cose = await verifyCose(raw, ENV_MANIFEST_CONTENT_TYPE, managerKeys, "sigk_");
  const fields = expectArray(decodeEnvironmentCbor(cose.payload), 21, "environment manifest");
  const domain = expectString(fields[0], "manifest domain");
  const wire = expectInteger(fields[1], "manifest wire version");
  const profile = expectInteger(fields[2], "manifest profile");
  const accountId = expectString(fields[3], "manifest account");
  const authorityGeneration = expectInteger(fields[4], "manifest authority generation");
  const authorityIdBytes = expectBytes(fields[5], 32, "manifest authority ID");
  const scopeKind = expectInteger(fields[6], "manifest scope kind");
  const machineId = expectNullableString(fields[7], "manifest machine ID");
  const stateKind = expectInteger(fields[8], "manifest scope state");
  const previousVersion = expectInteger(fields[9], "manifest previous version");
  const version = expectInteger(fields[10], "manifest version");
  const keyEpoch = expectInteger(fields[11], "manifest key epoch");
  const operation = expectBytes(fields[12], 16, "manifest operation ID");
  const salt = expectBytes(fields[13], 32, "manifest salt");
  const nonce = expectBytes(fields[14], 12, "manifest payload nonce");
  const mutation = expectInteger(fields[15], "manifest mutation kind");
  const changed = fields[16];
  const names = fields[17];
  const ciphertextDigest = expectBytes(fields[18], 32, "manifest ciphertext digest");
  const ciphertext = expectBytes(fields[19], undefined, "manifest ciphertext");
  const wrapsValue = fields[20];
  if (domain !== "paperboat.environment.scope-manifest" || wire !== 1 || profile !== 1 || accountId !== authority.accountId || authorityGeneration !== authority.generation || digestId(authorityIdBytes) !== authority.id || scopeKind > 1 || stateKind > 1 || version !== previousVersion + 1 || previousVersion > ENV_MAX_BROWSER_INTEGER || keyEpoch < 1 || mutation > 5 || !validateCiphertextLength(ciphertext.length) || !equalBytes(ciphertextDigest, await sha256(ciphertext)) || !Array.isArray(changed) || !Array.isArray(names) || !Array.isArray(wrapsValue)) throw new Error("Invalid environment manifest.");
  if (mutation === 0 && changed.length !== 0 || (mutation === 1 || mutation === 2) && changed.length !== 1) throw new Error("Invalid environment manifest mutation.");
  if (scopeKind === 0 && (machineId !== null || stateKind !== 0) || scopeKind === 1 && (!machineId || !IDENTIFIER.test(machineId))) throw new Error("Invalid manifest scope.");
  const scope = scopeKind === 0 ? "global" : "machine";
  const scopeState = stateKind === 0 ? "active" : "retired";
  const changedNames = sortedNames(changed.map((value) => expectString(value, "manifest changed name")), "manifest changed names");
  const manifestNames = sortedNames(names.map((value) => expectString(value, "manifest name")), "manifest names");
  if (changedNames.length > ENV_MAX_VARIABLES || manifestNames.length > ENV_MAX_VARIABLES) throw new Error("Manifest variable limit exceeded.");
  const wraps: EnvironmentRecipientWrap[] = wrapsValue.map((value) => {
    const fields = expectArray(value, 6, "manifest recipient wrap");
    const kind = expectInteger(fields[0], "wrap kind");
    const subjectId = validateIdentifier(expectString(fields[1], "wrap subject ID"), "wrap subject ID");
    const keyGeneration = expectInteger(fields[2], "wrap key generation");
    const keyId = expectString(fields[3], "wrap key ID");
    validateKeyId(keyId, "envk_");
    const encapsulatedKey = expectBytes(fields[4], 32, "wrap encapsulated key");
    const wrappedScopeKey = expectBytes(fields[5], 48, "wrap ciphertext");
    if (![1, 2, 3].includes(kind) || keyGeneration < 1) throw new Error("Invalid recipient wrap.");
    return { kind: kind as 1 | 2 | 3, subjectId, keyGeneration, keyId, encapsulatedKey, wrappedScopeKey };
  });
  if (wraps.length > (scope === "global" ? 545 : 34) || wraps.some((wrap, index) => index > 0 && recipientSortKey(wraps[index - 1]) >= recipientSortKey(wrap))) throw new Error("Manifest recipient wraps are not sorted.");
  if (expectedRecipientKeys(scope, machineId, scopeState, authority.bindings).join("\n") !== wraps.map(recipientSortKey).sort().join("\n")) throw new Error("Manifest recipient roster is not exact.");
  return { id: digestId(await sha256(raw)), raw, signerKeyId: cose.signerKeyId, accountId, authorityGeneration, authorityId: authority.id, scope, machineId, scopeState, previousVersion, version, keyEpoch, operationId: operationId(operation), mutationKind: mutation as EnvironmentManifest["mutationKind"], changedNames, names: manifestNames, ciphertextDigest, ciphertext, wraps };
}

async function signCose(payload: Uint8Array, keyId: string, privateKey: CryptoKey, contentType: string): Promise<Uint8Array> {
  const protectedBytes = encodeEnvironmentCbor(new Map<CborValue, CborValue>([[1, -8], [3, contentType], [4, textEncoder.encode(keyId)]]));
  const signatureInput = encodeEnvironmentCbor(["Signature1", protectedBytes, new Uint8Array(), payload]);
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, cryptoBytes(signatureInput)));
  return encodeEnvironmentCbor({ tag: 18, value: [protectedBytes, new Map<CborValue, CborValue>(), payload, signature] });
}

function scopeKind(scope: "global" | "machine"): number { return scope === "global" ? 0 : 1; }

function scopeMachine(scope: "global" | "machine", machineId?: string): string | null {
  if (scope === "global") return null;
  if (!machineId || !IDENTIFIER.test(machineId)) throw new Error("A valid machine ID is required.");
  return machineId;
}

function hpkeInfo(scope: "global" | "machine", machineId: string | null, scopeState: "active" | "retired", authority: EnvironmentAuthority, keyEpoch: number, version: number, operation: Uint8Array): Uint8Array {
  return encodeEnvironmentCbor(["paperboat.environment.hpke-info", 1, 1, authority.accountId, hexDigestBytes(authority.id), scopeKind(scope), machineId, scopeState === "active" ? 0 : 1, keyEpoch, version, operation]);
}

function hpkeWrapAad(scope: "global" | "machine", machineId: string | null, scopeState: "active" | "retired", authority: EnvironmentAuthority, previousVersion: number, version: number, keyEpoch: number, operation: Uint8Array, salt: Uint8Array, ciphertextDigest: Uint8Array, wrap: Pick<EnvironmentRecipientWrap, "kind" | "subjectId" | "keyGeneration" | "keyId">): Uint8Array {
  return encodeEnvironmentCbor(["paperboat.environment.wrap-aad", 1, 1, authority.accountId, authority.generation, hexDigestBytes(authority.id), scopeKind(scope), machineId, scopeState === "active" ? 0 : 1, previousVersion, version, keyEpoch, operation, salt, ciphertextDigest, wrap.kind, wrap.subjectId, wrap.keyGeneration, wrap.keyId]);
}

function hexDigestBytes(value: string): Uint8Array {
  if (!DIGEST_ID.test(value)) throw new Error("Invalid digest ID.");
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) bytes[index] = Number.parseInt(value.slice(7 + index * 2, 9 + index * 2), 16);
  return bytes;
}

function payloadKeyInfo(scope: "global" | "machine", machineId: string | null, scopeState: "active" | "retired", authority: EnvironmentAuthority, previousVersion: number, version: number, keyEpoch: number, operation: Uint8Array): Uint8Array {
  return encodeEnvironmentCbor(["paperboat.environment.payload-key", 1, authority.accountId, authority.id && hexDigestBytes(authority.id), scopeKind(scope), machineId, scopeState === "active" ? 0 : 1, previousVersion, version, keyEpoch, operation]);
}

function payloadAad(scope: "global" | "machine", machineId: string | null, scopeState: "active" | "retired", authority: EnvironmentAuthority, previousVersion: number, version: number, keyEpoch: number, operation: Uint8Array, salt: Uint8Array, nonce: Uint8Array, mutation: number, changedNames: string[], names: string[]): Uint8Array {
  return encodeEnvironmentCbor(["paperboat.environment.payload-aad", 1, 1, authority.accountId, authority.generation, hexDigestBytes(authority.id), scopeKind(scope), machineId, scopeState === "active" ? 0 : 1, previousVersion, version, keyEpoch, operation, salt, nonce, mutation, changedNames, names]);
}

async function hkdfExtractExpand(salt: Uint8Array, input: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", cryptoBytes(input), { name: "HKDF" }, false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: cryptoBytes(salt), info: cryptoBytes(info) }, key, length * 8));
}

async function hpkeSeal(publicBytes: Uint8Array, plaintext: Uint8Array, aad: Uint8Array, info: Uint8Array): Promise<{ enc: Uint8Array; ciphertext: Uint8Array }> {
  const publicKey = await hpkeSuite.kem.deserializePublicKey(publicBytes);
  const sender = await hpkeSuite.createSenderContext({ recipientPublicKey: publicKey, info });
  return { enc: cloneBytes(sender.enc), ciphertext: cloneBytes(await sender.seal(plaintext, aad)) };
}

async function hpkeOpen(privateKey: CryptoKey, enc: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
  const recipient = await hpkeSuite.createRecipientContext({ recipientKey: privateKey, enc, info });
  return cloneBytes(await recipient.open(ciphertext, aad));
}

function framePlaintext(values: EnvironmentVariableValue[]): Uint8Array {
  const entries = values.map(({ name, value }) => {
    validateVariableName(name);
    const valueBytes = textEncoder.encode(value);
    if (valueBytes.length > ENV_MAX_VALUE_BYTES || value.includes("\u0000") || hasUnpairedSurrogate(value)) throw new Error("Environment variable value is invalid.");
    return [name, valueBytes] as CborValue[];
  });
  entries.sort((left, right) => String(left[0]) < String(right[0]) ? -1 : String(left[0]) > String(right[0]) ? 1 : 0);
  const canonical = encodeEnvironmentCbor(["paperboat.environment.scope-plaintext", 1, entries]);
  if (canonical.length > ENV_MAX_PLAINTEXT_BYTES) throw new Error("Environment manifest plaintext exceeds the protocol limit.");
  const bucket = ENV_CIPHERTEXT_BUCKETS.find((candidate) => candidate >= canonical.length + 4);
  if (bucket === undefined) throw new Error("Environment manifest plaintext exceeds the protocol limit.");
  const framed = new Uint8Array(bucket);
  new DataView(framed.buffer).setUint32(0, canonical.length);
  framed.set(canonical, 4);
  crypto.getRandomValues(framed.subarray(4 + canonical.length));
  return framed;
}

async function unframePlaintext(raw: Uint8Array, names: string[]): Promise<EnvironmentVariableValue[]> {
  if (raw.length < 4) throw new Error("Invalid encrypted environment payload.");
  const length = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0);
  if (length > raw.length - 4) throw new Error("Invalid encrypted environment payload length.");
  const body = decodeEnvironmentCbor(raw.subarray(4, 4 + length));
  const fields = expectArray(body, 3, "environment plaintext");
  if (fields[0] !== "paperboat.environment.scope-plaintext" || fields[1] !== 1 || !Array.isArray(fields[2])) throw new Error("Invalid encrypted environment payload.");
  const values: EnvironmentVariableValue[] = fields[2].map((value) => {
    const pair = expectArray(value, 2, "environment plaintext entry");
    const name = validateVariableName(expectString(pair[0], "environment plaintext name"));
    const bytes = expectBytes(pair[1], undefined, "environment plaintext value");
    if (bytes.length > ENV_MAX_VALUE_BYTES) throw new Error("Environment value exceeds the protocol limit.");
    return { name, value: textDecoder.decode(bytes) };
  });
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1].name >= values[index].name) throw new Error("Encrypted environment names are not sorted.");
  }
  if (values.map((value) => value.name).join("\n") !== names.join("\n")) throw new Error("Encrypted names do not match manifest names.");
  return values;
}

// The parsed manifest deliberately keeps only public fields. These helpers
// recover salt/nonce from the already verified payload when decryption is
// requested, while never returning it to the API/BFF layer.
function manifestFields(manifest: EnvironmentManifest): CborValue[] {
  const decoded = decodeEnvironmentCbor(manifest.raw) as CborTag;
  if (!decoded || decoded.tag !== 18) throw new Error("Invalid manifest envelope.");
  const parts = expectArray(decoded.value, 4, "manifest envelope");
  return expectArray(decodeEnvironmentCbor(expectBytes(parts[2], undefined, "manifest payload")), 21, "manifest payload");
}

async function decryptManifestValues(manifest: EnvironmentManifest, authority: EnvironmentAuthority, record: EnvironmentManagerKeyRecord): Promise<EnvironmentVariableValue[]> {
  const fields = manifestFields(manifest);
  const salt = expectBytes(fields[13], 32, "manifest salt");
  const nonce = expectBytes(fields[14], 12, "manifest payload nonce");
  const operation = operationBytes(manifest.operationId);
  const wrap = manifest.wraps.find((value) => value.kind === 1 && value.subjectId === record.subjectId && value.keyGeneration === record.keyGeneration && value.keyId === record.recipientKeyId);
  if (!wrap) throw new Error("This browser is not a recipient of the selected environment scope.");
  const info = hpkeInfo(manifest.scope, manifest.machineId, manifest.scopeState, authority, manifest.keyEpoch, manifest.version, operation);
  const wrapAad = hpkeWrapAad(manifest.scope, manifest.machineId, manifest.scopeState, authority, manifest.previousVersion, manifest.version, manifest.keyEpoch, operation, salt, manifest.ciphertextDigest, wrap);
  const scopeKey = await hpkeOpen(record.recipientPrivateKey, wrap.encapsulatedKey, wrap.wrappedScopeKey, wrapAad, info);
  const payloadKeyBytes = await hkdfExtractExpand(salt, scopeKey, payloadKeyInfo(manifest.scope, manifest.machineId, manifest.scopeState, authority, manifest.previousVersion, manifest.version, manifest.keyEpoch, operation), 32);
  const payloadKey = await crypto.subtle.importKey("raw", cryptoBytes(payloadKeyBytes), { name: "AES-GCM" }, false, ["decrypt"]);
  const aad = payloadAad(manifest.scope, manifest.machineId, manifest.scopeState, authority, manifest.previousVersion, manifest.version, manifest.keyEpoch, operation, salt, nonce, manifest.mutationKind, manifest.changedNames, manifest.names);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: cryptoBytes(nonce), additionalData: cryptoBytes(aad), tagLength: 128 }, payloadKey, cryptoBytes(manifest.ciphertext)));
  try { return await unframePlaintext(padded, manifest.names); } finally { padded.fill(0); scopeKey.fill(0); payloadKeyBytes.fill(0); }
}

/** Decrypt a complete scope locally for an already enrolled manager browser. */
export async function decryptEnvironmentManifest(manifest: EnvironmentManifest, authority: EnvironmentAuthority, record: EnvironmentManagerKeyRecord): Promise<EnvironmentVariableValue[]> {
  if (record.recipientPrivateKey.extractable) throw new Error("Environment recipient key must be nonextractable.");
  if (record.signingPrivateKey.extractable) throw new Error("Environment signing key must be nonextractable.");
  return decryptManifestValues(manifest, authority, record);
}

/** Encrypt and sign a complete manifest. The returned value is opaque to HTTP callers. */
export async function createEnvironmentManifest(input: EnvironmentManifestMutationInput): Promise<{ envelope: string; manifest: EnvironmentManifest }> {
  const machineId = scopeMachine(input.scope, input.machineId);
  validateOperationId(input.operationId);
  if (input.current && (input.current.scope !== input.scope || input.current.machineId !== machineId)) throw new Error("The current manifest targets a different scope.");
  if (input.record.recipientPrivateKey.extractable || input.record.signingPrivateKey.extractable) throw new Error("Environment private keys must be nonextractable.");
  const existingValues = input.current ? await decryptManifestValues(input.current, input.authority, input.record) : [];
  const values = new Map(existingValues.map((item) => [item.name, item.value]));
  let mutation: 1 | 2 = 1;
  let changedName: string;
  if (input.value) {
    validateVariableName(input.value.name);
    if (textEncoder.encode(input.value.value).length > ENV_MAX_VALUE_BYTES || input.value.value.includes("\u0000") || hasUnpairedSurrogate(input.value.value)) throw new Error("Environment variable value is invalid.");
    values.set(input.value.name, input.value.value);
    changedName = input.value.name;
  } else if (input.unsetName) {
    validateVariableName(input.unsetName);
    values.delete(input.unsetName);
    changedName = input.unsetName;
    mutation = 2;
  } else throw new Error("A set or unset mutation is required.");
  const names = [...values.keys()].sort();
  const changedNames = [changedName].sort();
  const previousVersion = input.current?.version ?? 0;
  const version = previousVersion + 1;
  const keyEpoch = input.current?.keyEpoch ?? 1;
  const scopeState = input.current?.scopeState ?? "active";
  const operation = operationBytes(input.operationId);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const padded = framePlaintext(names.map((name) => ({ name, value: values.get(name)! })));
  const scopeKey = input.current ? await (async () => {
    const fields = manifestFields(input.current!);
    const currentSalt = expectBytes(fields[13], 32, "manifest salt");
    const currentOperation = operationBytes(input.current!.operationId);
    const currentWrap = input.current!.wraps.find((wrap) => wrap.kind === 1 && wrap.subjectId === input.record.subjectId && wrap.keyGeneration === input.record.keyGeneration && wrap.keyId === input.record.recipientKeyId);
    if (!currentWrap) throw new Error("This browser is not a recipient of the selected scope.");
    const info = hpkeInfo(input.current!.scope, input.current!.machineId, input.current!.scopeState, input.authority, input.current!.keyEpoch, input.current!.version, currentOperation);
    const aad = hpkeWrapAad(input.current!.scope, input.current!.machineId, input.current!.scopeState, input.authority, input.current!.previousVersion, input.current!.version, input.current!.keyEpoch, currentOperation, currentSalt, input.current!.ciphertextDigest, currentWrap);
    return hpkeOpen(input.record.recipientPrivateKey, currentWrap.encapsulatedKey, currentWrap.wrappedScopeKey, aad, info);
  })() : crypto.getRandomValues(new Uint8Array(32));
  const payloadKeyBytes = await hkdfExtractExpand(salt, scopeKey, payloadKeyInfo(input.scope, machineId, scopeState, input.authority, previousVersion, version, keyEpoch, operation), 32);
  const payloadKey = await crypto.subtle.importKey("raw", cryptoBytes(payloadKeyBytes), { name: "AES-GCM" }, false, ["encrypt"]);
  const aad = payloadAad(input.scope, machineId, scopeState, input.authority, previousVersion, version, keyEpoch, operation, salt, nonce, mutation, changedNames, names);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: cryptoBytes(nonce), additionalData: cryptoBytes(aad), tagLength: 128 }, payloadKey, cryptoBytes(padded)));
  const ciphertextDigest = await sha256(ciphertext);
  const wraps = await Promise.all(expectedRecipientKeys(input.scope, machineId, scopeState, input.authority.bindings).map(async (key) => {
    const [kindText, subjectId, generationText, keyId] = key.split("\u0000");
    const binding = input.authority.bindings.find((candidate) => candidate.recipientKeyId === keyId && candidate.subjectId === subjectId && candidate.keyGeneration === Number(generationText));
    if (!binding) throw new Error("Manifest recipient binding is unavailable.");
    const wrap = { kind: Number(kindText) as 1 | 2 | 3, subjectId, keyGeneration: Number(generationText), keyId };
    const sealed = await hpkeSeal(binding.recipientPublicKey, scopeKey, hpkeWrapAad(input.scope, machineId, scopeState, input.authority, previousVersion, version, keyEpoch, operation, salt, ciphertextDigest, wrap), hpkeInfo(input.scope, machineId, scopeState, input.authority, keyEpoch, version, operation));
    return { ...wrap, encapsulatedKey: sealed.enc, wrappedScopeKey: sealed.ciphertext };
  }));
  wraps.sort((left, right) => recipientSortKey(left) < recipientSortKey(right) ? -1 : recipientSortKey(left) > recipientSortKey(right) ? 1 : 0);
  const payload = encodeEnvironmentCbor(["paperboat.environment.scope-manifest", 1, 1, input.authority.accountId, input.authority.generation, hexDigestBytes(input.authority.id), scopeKind(input.scope), machineId, scopeState === "active" ? 0 : 1, previousVersion, version, keyEpoch, operation, salt, nonce, mutation, changedNames, names, ciphertextDigest, ciphertext, wraps.map((wrap) => [wrap.kind, wrap.subjectId, wrap.keyGeneration, wrap.keyId, wrap.encapsulatedKey, wrap.wrappedScopeKey])]);
  const raw = await signCose(payload, input.record.signingKeyId, input.record.signingPrivateKey, ENV_MANIFEST_CONTENT_TYPE);
  if (raw.length > ENV_MAX_MANIFEST_BYTES) throw new Error("Environment manifest exceeds the protocol limit.");
  const manifest = await parseEnvironmentManifest(raw, input.authority);
  padded.fill(0); scopeKey.fill(0); payloadKeyBytes.fill(0);
  return { envelope: base64UrlEncode(raw), manifest };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Browser key storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser key storage is unavailable."));
  });
}

async function readStoredManagerKeys(): Promise<EnvironmentManagerKeyRecord | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(KEY_STORE, "readonly").objectStore(KEY_STORE).get(MANAGER_KEY_ID);
      request.onsuccess = () => {
        const value = request.result as (Omit<EnvironmentManagerKeyRecord, "recipientPublicKey" | "signingPublicKey" | "rootPublicKey"> & { recipientPublicKey: ArrayBuffer; signingPublicKey: ArrayBuffer; rootPublicKey?: ArrayBuffer }) | undefined;
        resolve(value ? { ...value, recipientPublicKey: new Uint8Array(value.recipientPublicKey), signingPublicKey: new Uint8Array(value.signingPublicKey), rootPublicKey: value.rootPublicKey ? new Uint8Array(value.rootPublicKey) : undefined } : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Browser key storage is unavailable."));
    });
  } finally { db.close(); }
}

type StoredEnvironmentManagerState = {
  id: string;
  accountId?: string;
  rootKeyId?: string;
  authorityGeneration?: number;
  authorityId?: string;
  enrollment?: Omit<EnvironmentEnrollmentJournal, "canonical" | "digest"> & {
    canonical: ArrayBuffer;
    digest: ArrayBuffer;
  };
};

function storedBytes(value: unknown, field: string): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return cloneBytes(value);
  throw new Error(`Invalid stored ${field}.`);
}

function storedEnrollmentExpirySeconds(value: unknown): number {
  if (typeof value !== "string" || !validStoredUtcTimestamp(value)) {
    throw new Error("Stored environment enrollment expiry is invalid.");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds % 1000 !== 0) {
    throw new Error("Stored environment enrollment expiry is invalid.");
  }
  return milliseconds / 1000;
}

function validStoredUtcTimestamp(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59 && second <= 59;
}

function validateEnrollmentBody(body: Record<string, unknown>): void {
  const fields = [
    "schema", "operation_id", "subject_kind", "subject_id", "subject_generation", "key_generation",
    "endpoint_certificate", "signing_public_key", "signing_key_id", "signing_proof", "recipient_public_key",
    "recipient_key_id", "binding_not_after", "request_expires_at",
  ];
  if (Object.keys(body).length !== fields.length || fields.some((field) => !(field in body))) throw new Error("Stored environment enrollment request is invalid.");
  if (body.schema !== "paperboat.environment-key-enrollment/v1" || body.subject_kind !== "manager_browser" || body.endpoint_certificate !== null || body.binding_not_after !== null) throw new Error("Stored environment enrollment request is invalid.");
  if (typeof body.operation_id !== "string" || !OPERATION_ID.test(body.operation_id) || typeof body.subject_id !== "string" || !IDENTIFIER.test(body.subject_id) || typeof body.subject_generation !== "number" || !Number.isSafeInteger(body.subject_generation) || body.subject_generation < 1 || typeof body.key_generation !== "number" || !Number.isSafeInteger(body.key_generation) || body.key_generation < 1 || typeof body.signing_public_key !== "string" || typeof body.signing_key_id !== "string" || typeof body.signing_proof !== "string" || typeof body.recipient_public_key !== "string" || typeof body.recipient_key_id !== "string" || typeof body.request_expires_at !== "string") throw new Error("Stored environment enrollment request is invalid.");
  safeStoredBase64(body.signing_public_key, 32, "signing public key");
  safeStoredBase64(body.signing_proof, 64, "signing proof");
  safeStoredBase64(body.recipient_public_key, 32, "recipient public key");
  validateKeyId(body.signing_key_id, "sigk_");
  validateKeyId(body.recipient_key_id, "envk_");
  storedEnrollmentExpirySeconds(body.request_expires_at);
}

function safeStoredBase64(value: string, expectedBytes: number, field: string): void {
  const decoded = base64UrlDecode(value, expectedBytes, field);
  if (decoded.length !== expectedBytes) throw new Error(`Stored ${field} is invalid.`);
  decoded.fill(0);
}

async function readStoredManagerState(): Promise<StoredEnvironmentManagerState | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STATE_STORE, "readonly").objectStore(STATE_STORE).get(MANAGER_STATE_ID);
      request.onsuccess = () => resolve(request.result as StoredEnvironmentManagerState | undefined ?? null);
      request.onerror = () => reject(request.error ?? new Error("Browser key storage is unavailable."));
    });
  } finally { db.close(); }
}

async function writeStoredManagerState(state: StoredEnvironmentManagerState): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STATE_STORE, "readwrite").objectStore(STATE_STORE).put(state);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Browser key storage is unavailable."));
    });
  } finally { db.close(); }
}

/** Return only the locally generated manager key record. */
export async function getStoredEnvironmentManagerKeys(): Promise<EnvironmentManagerKeyRecord | null> {
  return readStoredManagerKeys();
}

/** Read the browser's durable, public authority high-water checkpoint. */
export async function getEnvironmentAuthorityCheckpoint(): Promise<EnvironmentAuthorityCheckpoint | null> {
  const state = await readStoredManagerState();
  if (!state) return null;
  if (state.rootKeyId !== undefined && !/^aek_[0-9a-f]{64}$/.test(state.rootKeyId)) throw new Error("Stored environment root key ID is invalid.");
  const checkpointFields = [state.accountId, state.authorityGeneration, state.authorityId];
  if (checkpointFields.some((value) => value !== undefined) && checkpointFields.some((value) => value === undefined)) throw new Error("Stored environment authority state is incomplete.");
  if (checkpointFields.every((value) => value === undefined)) return null;
  if (!state.accountId || !state.rootKeyId || state.authorityGeneration === undefined || !state.authorityId) throw new Error("Stored environment authority state is incomplete.");
  validateIdentifier(state.accountId, "stored account ID");
  if (!/^aek_[0-9a-f]{64}$/.test(state.rootKeyId) || !DIGEST_ID.test(state.authorityId) || !Number.isSafeInteger(state.authorityGeneration) || state.authorityGeneration < 1) throw new Error("Stored environment authority state is invalid.");
  return { accountId: state.accountId, rootKeyId: state.rootKeyId, generation: state.authorityGeneration, authorityId: state.authorityId };
}

/** Read the public enrollment journal needed to safely reconcile a request. */
export async function getEnvironmentEnrollmentJournal(): Promise<EnvironmentEnrollmentJournal | null> {
  const state = await readStoredManagerState();
  const value = state?.enrollment;
  if (!value) return null;
  const canonical = storedBytes(value.canonical, "enrollment request");
  const digest = storedBytes(value.digest, "enrollment digest");
  if (canonical.length === 0 || canonical.length > 8 * 1024 || digest.length !== 32 || value.state !== "created" && value.state !== "challenge" && value.state !== "pending" || typeof value.accountId !== "string" || typeof value.operationId !== "string" || typeof value.subjectId !== "string" || typeof value.subjectGeneration !== "number" || typeof value.keyGeneration !== "number" || typeof value.requestExpiresAt !== "string" || typeof value.safetyCode !== "string" || !value.requestBody || typeof value.requestBody !== "object" || Array.isArray(value.requestBody)) throw new Error("Stored environment enrollment state is invalid.");
  validateIdentifier(value.accountId, "stored enrollment account ID");
  validateOperationId(value.operationId);
  validateIdentifier(value.subjectId, "stored enrollment subject ID");
  if (!Number.isSafeInteger(value.subjectGeneration) || value.subjectGeneration < 1 || !Number.isSafeInteger(value.keyGeneration) || value.keyGeneration < 1 || !/^[a-z2-7]{4}(?:-[a-z2-7]{4}){3}$/.test(value.safetyCode)) throw new Error("Stored environment enrollment state is invalid.");
  if ((value.requestId !== undefined && (typeof value.requestId !== "string" || !IDENTIFIER.test(value.requestId))) || (value.state !== "created" && value.requestId === undefined)) throw new Error("Stored environment enrollment state is invalid.");
  storedEnrollmentExpirySeconds(value.requestExpiresAt);
  validateEnrollmentBody(value.requestBody);
  const expectedDigest = await sha256(canonical);
  if (!equalBytes(expectedDigest, digest)) throw new Error("Stored environment enrollment digest is invalid.");
  expectedDigest.fill(0);
  return { ...value, canonical, digest, requestBody: { ...value.requestBody } };
}

/**
 * Durably journal a browser enrollment before sending it to the control plane.
 * The journal contains only public request material and is monotonic: a
 * challenge or pending state can never be replaced by an older request.
 */
export async function persistEnvironmentEnrollmentJournal(journal: EnvironmentEnrollmentJournal): Promise<void> {
  validateIdentifier(journal.accountId, "enrollment account");
  validateOperationId(journal.operationId);
  validateIdentifier(journal.subjectId, "enrollment subject ID");
  if (!Number.isSafeInteger(journal.subjectGeneration) || journal.subjectGeneration < 1 || !Number.isSafeInteger(journal.keyGeneration) || journal.keyGeneration < 1) throw new Error("The enrollment journal generations are invalid.");
  if (journal.requestId !== undefined && !IDENTIFIER.test(journal.requestId)) throw new Error("The enrollment request ID is invalid.");
  if (journal.state !== "created" && journal.state !== "challenge" && journal.state !== "pending") throw new Error("The enrollment journal state is invalid.");
  const expirySeconds = storedEnrollmentExpirySeconds(journal.requestExpiresAt);
  const canonical = cloneBytes(journal.canonical);
  const digest = cloneBytes(journal.digest);
  if (canonical.length === 0 || canonical.length > 8 * 1024 || digest.length !== 32) throw new Error("The enrollment journal is too large.");
  const request = await parseBrowserEnrollmentRequest(canonical);
  const expectedDigest = await sha256(canonical);
  const expectedSafety = await environmentSafetyCode(canonical);
  if (!equalBytes(expectedDigest, digest) || expectedSafety !== journal.safetyCode || request.accountId !== journal.accountId || request.operationId !== journal.operationId || request.subjectId !== journal.subjectId || request.subjectGeneration !== journal.subjectGeneration || request.keyGeneration !== journal.keyGeneration || request.expiresAtSeconds !== expirySeconds) throw new Error("The enrollment journal does not match its canonical request.");
  validateEnrollmentBody(journal.requestBody);
  const body = journal.requestBody;
  if (body.operation_id !== request.operationId || body.subject_id !== request.subjectId || body.subject_generation !== request.subjectGeneration || body.key_generation !== request.keyGeneration || body.signing_key_id !== request.signingKeyId || body.recipient_key_id !== request.recipientKeyId || storedEnrollmentExpirySeconds(body.request_expires_at) !== request.expiresAtSeconds || !equalBytes(base64UrlDecode(body.signing_public_key as string, 32, "signing public key"), request.signingPublicKey) || !equalBytes(base64UrlDecode(body.recipient_public_key as string, 32, "recipient public key"), request.recipientPublicKey)) throw new Error("The enrollment journal request body does not match its canonical request.");
  expectedDigest.fill(0);
  canonical.fill(0);
  digest.fill(0);

  const encodedCanonical = journal.canonical.buffer.slice(journal.canonical.byteOffset, journal.canonical.byteOffset + journal.canonical.byteLength);
  const encodedDigest = journal.digest.buffer.slice(journal.digest.byteOffset, journal.digest.byteOffset + journal.digest.byteLength);
  await updateStoredManagerState((state) => {
    const previous = state.enrollment;
    if (previous) {
      const previousCanonical = storedBytes(previous.canonical, "enrollment request");
      const previousDigest = storedBytes(previous.digest, "enrollment digest");
      if (previous.accountId !== journal.accountId || previous.operationId !== journal.operationId || previous.subjectId !== journal.subjectId || previous.subjectGeneration !== journal.subjectGeneration || previous.keyGeneration !== journal.keyGeneration || !equalBytes(previousCanonical, journal.canonical) || !equalBytes(previousDigest, journal.digest) || previous.requestId !== undefined && previous.requestId !== journal.requestId) throw new Error("A different browser enrollment is already journaled.");
      const rank = { created: 0, challenge: 1, pending: 2 } as const;
      if (rank[journal.state] < rank[previous.state]) throw new Error("The browser enrollment journal cannot move backwards.");
    }
    return {
      ...state,
      id: MANAGER_STATE_ID,
      enrollment: {
        accountId: journal.accountId,
        operationId: journal.operationId,
        subjectId: journal.subjectId,
        subjectGeneration: journal.subjectGeneration,
        keyGeneration: journal.keyGeneration,
        requestId: journal.requestId,
        requestExpiresAt: journal.requestExpiresAt,
        canonical: encodedCanonical,
        digest: encodedDigest,
        safetyCode: journal.safetyCode,
        requestBody: { ...journal.requestBody },
        state: journal.state,
      },
    };
  });
}

async function updateStoredManagerState(update: (state: StoredEnvironmentManagerState) => StoredEnvironmentManagerState): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STATE_STORE, "readwrite");
      const store = transaction.objectStore(STATE_STORE);
      const request = store.get(MANAGER_STATE_ID);
      let settled = false;
      const fail = (error: unknown) => {
        if (!settled) { settled = true; reject(error instanceof Error ? error : new Error("Browser key storage is unavailable.")); }
      };
      request.onerror = () => fail(request.error ?? new Error("Browser key storage is unavailable."));
      request.onsuccess = () => {
        let next: StoredEnvironmentManagerState;
        try { next = update(request.result as StoredEnvironmentManagerState | undefined ?? { id: MANAGER_STATE_ID }); } catch (error) { fail(error); return; }
        const put = store.put({ ...next, id: MANAGER_STATE_ID });
        put.onerror = () => fail(put.error ?? new Error("Browser key storage is unavailable."));
      };
      transaction.onerror = () => fail(transaction.error ?? new Error("Browser key storage is unavailable."));
      transaction.onabort = () => fail(transaction.error ?? new Error("Browser key storage is unavailable."));
      transaction.oncomplete = () => { if (!settled) { settled = true; resolve(); } };
    });
  } finally { db.close(); }
}

/** Atomically advance the browser authority checkpoint by one verified document. */
export async function persistEnvironmentAuthorityCheckpoint(authority: EnvironmentAuthority, rootPublicKey: Uint8Array): Promise<EnvironmentAuthorityCheckpoint> {
  if (rootPublicKey.length !== 32 || !Number.isSafeInteger(authority.generation) || authority.generation < 1 || !DIGEST_ID.test(authority.id) || !IDENTIFIER.test(authority.accountId)) throw new Error("The environment authority checkpoint is invalid.");
  const rootKeyId = await environmentRootKeyId(rootPublicKey);
  const checkpoint: EnvironmentAuthorityCheckpoint = { accountId: authority.accountId, rootKeyId, generation: authority.generation, authorityId: authority.id };
  await updateStoredManagerState((state) => {
    const currentFields = [state.accountId, state.authorityGeneration, state.authorityId];
    if ((currentFields.some((value) => value !== undefined) && currentFields.some((value) => value === undefined)) || (currentFields.some((value) => value !== undefined) && !state.rootKeyId)) throw new Error("Stored environment authority state is incomplete.");
    if (state.rootKeyId && state.rootKeyId !== checkpoint.rootKeyId) throw new Error("The pinned environment root changed.");
    if (state.accountId && state.rootKeyId && state.authorityGeneration !== undefined && state.authorityId) {
      const previous: EnvironmentAuthorityCheckpoint = { accountId: state.accountId, rootKeyId: state.rootKeyId, generation: state.authorityGeneration, authorityId: state.authorityId };
      if (previous.accountId !== checkpoint.accountId || previous.rootKeyId !== checkpoint.rootKeyId || checkpoint.generation < previous.generation || checkpoint.generation === previous.generation && checkpoint.authorityId !== previous.authorityId || checkpoint.generation > previous.generation + 1) throw new Error("Environment authority rollback or fork detected.");
    } else if (checkpoint.generation !== 1) {
      throw new Error("The first environment authority generation must be one.");
    }
    return { ...state, id: MANAGER_STATE_ID, accountId: checkpoint.accountId, rootKeyId: checkpoint.rootKeyId, authorityGeneration: checkpoint.generation, authorityId: checkpoint.authorityId };
  });
  return checkpoint;
}

/** Store generated keys without ever exporting or serializing private material. */
export async function storeEnvironmentManagerKeys(record: EnvironmentManagerKeyRecord): Promise<void> {
  if (record.recipientPrivateKey.extractable || record.signingPrivateKey.extractable) throw new Error("Environment private keys must be nonextractable.");
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(KEY_STORE, "readwrite").objectStore(KEY_STORE).put({ ...record, id: MANAGER_KEY_ID, recipientPublicKey: record.recipientPublicKey.buffer.slice(record.recipientPublicKey.byteOffset, record.recipientPublicKey.byteOffset + record.recipientPublicKey.byteLength), signingPublicKey: record.signingPublicKey.buffer.slice(record.signingPublicKey.byteOffset, record.signingPublicKey.byteOffset + record.signingPublicKey.byteLength), rootPublicKey: record.rootPublicKey?.buffer.slice(record.rootPublicKey.byteOffset, record.rootPublicKey.byteOffset + record.rootPublicKey.byteLength) });
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error ?? new Error("Browser key storage is unavailable."));
    });
  } finally { db.close(); }
}

/** Generate a new local manager key pair; enrollment still requires explicit approval. */
export async function generateEnvironmentManagerKeys(subjectId: string, rootPublicKey?: Uint8Array): Promise<EnvironmentManagerKeyRecord> {
  validateIdentifier(subjectId, "browser enrollment ID");
  if (rootPublicKey && rootPublicKey.length !== 32) throw new Error("Invalid environment root key.");
  const recipient = await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
  const signing = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign"]);
  const recipientPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", recipient.publicKey));
  const signingPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", signing.publicKey));
  const record: EnvironmentManagerKeyRecord = { subjectId, subjectGeneration: 1, keyGeneration: 1, recipientKeyId: await environmentKeyId("X25519", recipientPublicKey), recipientPublicKey, recipientPrivateKey: recipient.privateKey, signingKeyId: await environmentKeyId("Ed25519", signingPublicKey), signingPublicKey, signingPrivateKey: signing.privateKey, rootPublicKey: rootPublicKey ? cloneBytes(rootPublicKey) : undefined };
  await storeEnvironmentManagerKeys(record);
  const rootKeyId = rootPublicKey ? await environmentRootKeyId(rootPublicKey) : undefined;
  await updateStoredManagerState((state) => ({
    id: MANAGER_STATE_ID,
    rootKeyId,
    // A fresh manager key is a fresh enrollment principal. Never carry a
    // previous account's authority or enrollment checkpoint into it.
  }));
  return record;
}

/** Determine whether the browser has a matching root-authorized active binding. */
export async function environmentManagerStatus(authority?: EnvironmentAuthority, rootPublicKey?: Uint8Array): Promise<EnvironmentManagerStatus> {
  let record: EnvironmentManagerKeyRecord | null;
  let checkpoint: EnvironmentAuthorityCheckpoint | null;
  try {
    record = await readStoredManagerKeys();
    checkpoint = await getEnvironmentAuthorityCheckpoint();
  } catch { return { enrolled: false, reason: "storage_unavailable" }; }
  if (!record) return { enrolled: false, reason: "local_key_missing" };
  const trustedRoot = rootPublicKey ?? record.rootPublicKey;
  if (!trustedRoot) return { enrolled: false, reason: "root_unavailable" };
  if (!authority) return { enrolled: false, reason: "authority_unavailable" };
  if (!record.rootPublicKey || !equalBytes(record.rootPublicKey, trustedRoot)) return { enrolled: false, reason: "root_unavailable" };
  // Never treat a server-fetched authority as trust data until its root
  // signature has been checked again at the browser security boundary.
  try {
    authority = await parseEnvironmentAuthority(authority.raw, trustedRoot);
  } catch {
    return { enrolled: false, reason: "authority_unavailable" };
  }
  const rootKeyId = await environmentRootKeyId(trustedRoot);
  if (!checkpoint || checkpoint.accountId !== authority.accountId || checkpoint.rootKeyId !== rootKeyId || checkpoint.generation !== authority.generation || checkpoint.authorityId !== authority.id) {
    return { enrolled: false, reason: "authority_unavailable" };
  }
  const binding = authority.bindings.find((candidate) => candidate.subjectKind === 2 && candidate.subjectId === record!.subjectId && candidate.keyGeneration === record!.keyGeneration && candidate.recipientKeyId === record!.recipientKeyId && candidate.signingKeyId === record!.signingKeyId && candidate.signingPublicKey && equalBytes(candidate.signingPublicKey, record!.signingPublicKey) && equalBytes(candidate.recipientPublicKey, record!.recipientPublicKey));
  if (!binding) return { enrolled: false, reason: "binding_missing" };
  return { enrolled: true, reason: "ready", record, authority, binding };
}

export async function decodeEnvironmentEnvelope(value: string, max = ENV_MAX_MANIFEST_BYTES): Promise<Uint8Array> { return base64UrlDecode(value, max, "environment envelope"); }

/** Open the one-time enrollment challenge inside the enrolled browser. */
export async function openEnvironmentEnrollmentChallenge(record: EnvironmentManagerKeyRecord, state: { requestId: string; enrollmentRequest: string; challenge: string; expiresAt: string }): Promise<Uint8Array> {
  if (record.recipientPrivateKey.extractable || record.signingPrivateKey.extractable) throw new Error("Environment private keys must be nonextractable.");
  validateIdentifier(state.requestId, "enrollment request ID");
  const canonical = base64UrlDecode(state.enrollmentRequest, 8 * 1024, "enrollment request");
  const request = await parseBrowserEnrollmentRequest(canonical);
  const journal = await getEnvironmentEnrollmentJournal();
  if (!journal) throw new Error("The enrollment challenge does not match this browser's journaled request.");
  const journalExpirySeconds = storedEnrollmentExpirySeconds(journal.requestExpiresAt);
  const stateExpirySeconds = storedEnrollmentExpirySeconds(state.expiresAt);
  const expectedDigest = await sha256(canonical);
  const matchesJournal = journal.requestId === state.requestId &&
    equalBytes(journal.canonical, canonical) &&
    equalBytes(journal.digest, expectedDigest) &&
    journal.subjectId === record.subjectId &&
    journal.subjectGeneration === record.subjectGeneration &&
    journal.keyGeneration === record.keyGeneration &&
    request.accountId === journal.accountId &&
    request.operationId === journal.operationId &&
    request.subjectId === record.subjectId &&
    request.subjectGeneration === record.subjectGeneration &&
    request.keyGeneration === record.keyGeneration &&
    request.expiresAtSeconds === journalExpirySeconds &&
    stateExpirySeconds === request.expiresAtSeconds &&
    equalBytes(request.signingPublicKey, record.signingPublicKey) &&
    request.signingKeyId === record.signingKeyId &&
    equalBytes(request.recipientPublicKey, record.recipientPublicKey) &&
    request.recipientKeyId === record.recipientKeyId &&
    journal.state === "challenge" &&
    Date.now() < request.expiresAtSeconds * 1000;
  expectedDigest.fill(0);
  if (!matchesJournal) throw new Error("The enrollment challenge does not match this browser's journaled request.");
  const accountId = request.accountId;
  const operation = operationBytes(request.operationId);
  const recipientKeyId = request.recipientKeyId;
  const sealed = base64UrlDecode(state.challenge, 1 * 1024, "enrollment challenge");
  if (sealed.length !== 80) throw new Error("Invalid environment enrollment challenge.");
  const info = encodeEnvironmentCbor([ENROLLMENT_CHALLENGE_INFO_SCHEMA, 1, 1, accountId, validateIdentifier(state.requestId, "enrollment request ID"), operation, recipientKeyId]);
  const aadDigest = await sha256(canonical);
  const aad = encodeEnvironmentCbor([ENROLLMENT_CHALLENGE_AAD_SCHEMA, 1, aadDigest]);
  aadDigest.fill(0);
  const challenge = await hpkeOpen(record.recipientPrivateKey, sealed.subarray(0, 32), sealed.subarray(32), aad, info);
  if (challenge.length !== 32) throw new Error("Invalid environment enrollment challenge.");
  return challenge;
}

/** Build a challenge proof for browser enrollment without exposing key material. */
export async function enrollmentProof(record: EnvironmentManagerKeyRecord, state: { accountId: string; requestId: string; operationId: string; requestDigest: Uint8Array; challenge: Uint8Array }): Promise<Uint8Array> {
  if (record.recipientPrivateKey.extractable || record.signingPrivateKey.extractable) throw new Error("Environment private keys must be nonextractable.");
  validateIdentifier(state.accountId, "enrollment account");
  validateIdentifier(state.requestId, "enrollment request ID");
  validateOperationId(state.operationId);
  if (state.requestDigest.length !== 32 || state.requestDigest.every((byte) => byte === 0) || state.challenge.length !== 32) throw new Error("The environment enrollment proof inputs are invalid.");
  const input = encodeEnvironmentCbor([ENROLLMENT_PROOF_SCHEMA, 1, state.accountId, state.requestId, operationBytes(state.operationId), state.requestDigest, state.challenge]);
  return sha256(input);
}

export interface BrowserEnrollmentInput {
  accountId: string;
  operationId: string;
  requestExpiresAt: Date;
  record: EnvironmentManagerKeyRecord;
}

/**
 * Create the public browser enrollment request and its Ed25519 possession
 * proof. The returned object contains no private key and no environment value.
 */
export async function createEnvironmentEnrollmentRequest(input: BrowserEnrollmentInput): Promise<{
  body: Record<string, unknown>;
  canonical: Uint8Array;
  digest: Uint8Array;
  safetyCode: string;
}> {
  validateIdentifier(input.accountId, "enrollment account");
  validateOperationId(input.operationId);
  if (input.record.recipientPrivateKey.extractable || input.record.signingPrivateKey.extractable) throw new Error("Environment private keys must be nonextractable.");
  if (!Number.isFinite(input.requestExpiresAt.getTime()) || input.requestExpiresAt.getMilliseconds() !== 0 || input.requestExpiresAt.getTime() <= Date.now() || input.requestExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) throw new Error("The enrollment expiry is invalid.");
  const expiresAtSeconds = Math.floor(input.requestExpiresAt.getTime() / 1000);
  const canonical = encodeEnvironmentCbor([ENROLLMENT_REQUEST_SCHEMA, ENROLLMENT_REQUEST_VERSION, input.accountId, operationBytes(input.operationId), 2, input.record.subjectId, input.record.subjectGeneration, input.record.keyGeneration, null, input.record.signingPublicKey, input.record.signingKeyId, input.record.recipientPublicKey, input.record.recipientKeyId, null, expiresAtSeconds]);
  const signatureInput = encodeEnvironmentCbor([ENROLLMENT_REQUEST_SIGNATURE_SCHEMA, 1, canonical]);
  const signingProof = new Uint8Array(await crypto.subtle.sign("Ed25519", input.record.signingPrivateKey, cryptoBytes(signatureInput)));
  const digest = await sha256(canonical);
  const safetyCode = await environmentSafetyCode(canonical);
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  return {
    body: {
      schema: "paperboat.environment-key-enrollment/v1",
      operation_id: input.operationId,
      subject_kind: "manager_browser",
      subject_id: input.record.subjectId,
      subject_generation: input.record.subjectGeneration,
      key_generation: input.record.keyGeneration,
      endpoint_certificate: null,
      signing_public_key: base64UrlEncode(input.record.signingPublicKey),
      signing_key_id: input.record.signingKeyId,
      signing_proof: base64UrlEncode(signingProof),
      recipient_public_key: base64UrlEncode(input.record.recipientPublicKey),
      recipient_key_id: input.record.recipientKeyId,
      binding_not_after: null,
      request_expires_at: expiresAt,
    },
    canonical,
    digest,
    safetyCode,
  };
}

export function environmentSafetyCode(canonicalRequest: Uint8Array): Promise<string> {
  return (async () => {
    const digest = await sha256(encodeEnvironmentCbor([ENROLLMENT_SAFETY_CODE_SCHEMA, 1, canonicalRequest]));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let output = "";
    let buffer = 0;
    let bits = 0;
    for (const byte of digest.subarray(0, 10)) {
      buffer = (buffer << 8) | byte; bits += 8;
      while (bits >= 5) { bits -= 5; output += alphabet[(buffer >>> bits) & 31].toLowerCase(); }
    }
    if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31].toLowerCase();
    return `${output.slice(0, 4)}-${output.slice(4, 8)}-${output.slice(8, 12)}-${output.slice(12, 16)}`;
  })();
}
