/**
 * Password hashing port. The adapter picks the algorithm (bcrypt/argon2/scrypt).
 * The core use-case is hash-agnostic so the same tests run against a fake
 * "plain text compare" hasher in unit tests and against bcrypt in production.
 */
export interface PasswordHasher {
  readonly name: string;
  /** Produce a one-way hash string, suitable to store in the DB. */
  hash(plain: string): Promise<string>;
  /** Constant-time compare. Returns false for any malformed hash. */
  verify(plain: string, hashed: string): Promise<boolean>;
}
