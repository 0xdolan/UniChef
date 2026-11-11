<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# HMAC and key derivation

A hash proves that data has not changed only if the attacker cannot change the digest too.
To prove that a message came from someone who knows a secret, you need a **message
authentication code** (MAC). To turn a password into an encryption key, you need a **key
derivation function** (KDF). Both are built from hashes.

## HMAC

`hash(key ‖ message)` looks like a MAC but is not one: SHA-256 and the other Merkle–Damgård
hashes allow length extension (see [hashing](hashing.md)). **HMAC** (RFC 2104) fixes that by
hashing twice with two derived keys:

```
HMAC(K, m) = H( (K' ⊕ opad) ‖ H( (K' ⊕ ipad) ‖ m ) )
```

1. **Prepare the key.** If `K` is longer than the hash's block size (64 bytes for SHA-256,
   128 for SHA-512), replace it with `H(K)`. Then pad it with zero bytes to the block size:
   that is `K'`.
2. **Inner hash.** XOR `K'` with `ipad`, the byte `0x36` repeated, and hash it followed by the
   message.
3. **Outer hash.** XOR `K'` with `opad`, the byte `0x5c` repeated, and hash it followed by the
   inner digest.

The outer hash hides the inner state, so length extension is impossible. HMAC stays secure
even with MD5 or SHA-1, whose collisions do not break it, though new designs should use
SHA-256 or better.

HMAC signs API requests (AWS Signature V4), webhooks (GitHub's `X-Hub-Signature-256`), JWTs
with `HS256`, and TOTP codes. To check an HMAC in code, compare in **constant time**
(`hmac.compare_digest` in Python, `crypto.timingSafeEqual` in Node): an ordinary `==` stops
at the first different byte, and the time it takes leaks how many bytes were right.

Try it with [HMAC](../reference/ops/hmac.md): `message` with key `secret` and SHA-256 gives
`8b5f48702995c1598c573db1e21866a9b825d4a794d169d7060a03605796360b`.

## Password hashing and key derivation

Passwords are short and guessable. If a database stores `SHA-256(password)`, an attacker
with the database tries billions of guesses per second on a GPU, and one precomputed table
cracks every user with the same password. A password KDF defends against this with:

- a **salt**: random bytes, different for every user, stored next to the hash. The same
  password then gives different hashes, and precomputed tables are useless.
- a **work factor**: the function is deliberately slow, so each guess costs the attacker as
  much as it costs you.
- ideally, **memory hardness**, so that GPUs and custom chips gain little.

## PBKDF2

**PBKDF2** (RFC 8018) runs HMAC many times. For each block `i` of output:

```
U1 = HMAC(password, salt ‖ INT(i))
U2 = HMAC(password, U1)
…
Uc = HMAC(password, Uc-1)
T_i = U1 ⊕ U2 ⊕ … ⊕ Uc
```

`c` is the iteration count. The output is `T_1 ‖ T_2 ‖ …`, cut to the length you asked for.
[PBKDF2](../reference/ops/pbkdf2.md) defaults to HMAC-SHA-256 with 100 000 iterations and
warns below that. OWASP currently recommends 600 000 iterations for PBKDF2-HMAC-SHA256.
PBKDF2 is not memory-hard; for new password storage OWASP prefers Argon2id or scrypt, which
UniChef plans for milestone 1.2 (see the [roadmap](../roadmap.md)). PBKDF2 remains the
FIPS-approved choice and is used by Wi-Fi WPA2, macOS FileVault, many password managers and
encrypted ZIP and Office files.

<!-- docs:ops -->
Operations explained here: [HMAC](../reference/ops/hmac.md), [PBKDF2](../reference/ops/pbkdf2.md).
<!-- /docs:ops -->

## Learn more

- [RFC 2104: HMAC](https://www.rfc-editor.org/rfc/rfc2104)
- [RFC 8018: PKCS #5 v2.1 and PBKDF2](https://www.rfc-editor.org/rfc/rfc8018)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Length extension attacks on Wikipedia](https://en.wikipedia.org/wiki/Length_extension_attack)

<!-- docs:nav -->
---

[← Hashing](hashing.md) · [Contents](../README.md) · [Encryption →](encryption.md)
<!-- /docs:nav -->
