<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Hashing

A **hash function** turns input of any length into a short, fixed-length value, the
**digest**. The same input always gives the same digest, and changing a single bit of the
input changes about half the bits of the digest:

| Input | SHA-256 |
|---|---|
| `abc` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` |
| `abd` | `a52d159f262b2c6ddb724a61840befc36eb30c88877a4030b65cbe86298449c9` |

Hashes identify files (malware samples are named by their SHA-256), check that a download
was not corrupted or tampered with, index data, and sit inside signatures, HMACs, key
derivation, Git and blockchains.

## What makes a hash cryptographic

A **cryptographic hash** must resist three attacks:

1. **Preimage:** given a digest, finding any input that has it should be infeasible.
2. **Second preimage:** given an input, finding a different input with the same digest should
   be infeasible.
3. **Collision:** finding any two inputs with the same digest should be infeasible. Because of
   the birthday paradox, a generic attack on an n-bit digest takes about 2^(n/2) tries, so a
   256-bit hash gives 128-bit collision security.

**Checksums** such as CRC-32 and Adler-32 have none of these properties. They detect
accidental errors (a flipped bit on a disk or a network) cheaply, but anyone can forge a
matching checksum in microseconds. Never use them for security.

## Inside the common hashes

**MD5, SHA-1 and SHA-2: Merkle–Damgård.** These pad the message, split it into fixed blocks
(512 bits, or 1024 for SHA-384/512) and feed each block into a **compression function**
together with a running state. The final state is the digest.

1. **Padding.** Append a `1` bit, then `0` bits until the length is 64 bits short of a block
   boundary, then the original length in bits as a 64-bit number (128 bits for SHA-512).
   `abc` (24 bits) becomes one 512-bit block: `61 62 63 80 00 … 00 00 00 00 00 00 00 00 18`.
2. **Initial state.** Fixed constants: for SHA-256, eight 32-bit words taken from the
   fractional parts of the square roots of the first eight primes.
3. **Compression.** The block is expanded into a message schedule (64 words for SHA-256), and
   64 rounds mix each word into the state with additions, rotations and bitwise functions
   (`Ch`, `Maj`, `Σ0`, `Σ1`), using round constants from the cube roots of the first 64 primes.
4. **Output.** After the last block, the state words, written big-endian, are the digest.

Because the digest *is* the internal state, these hashes allow **length extension**: knowing
`H(secret ‖ message)` and the length of `secret`, anyone can compute
`H(secret ‖ message ‖ padding ‖ more)` without the secret. That is why `hash(key + message)`
is not a safe MAC: use [HMAC](../reference/ops/hmac.md). SHA-512/224 and SHA-512/256 truncate
their state and resist this.

**SHA-3 and SHAKE: the sponge.** SHA-3 (Keccak) keeps a 1600-bit state. It **absorbs** the
padded input in blocks, XOR-ing each into part of the state (the *rate*) and running the
Keccak-f permutation (24 rounds of θ, ρ, π, χ and ι), then **squeezes** out the digest. The
rest of the state (the *capacity*) is never output, so length extension is impossible.
**SHAKE128** and **SHAKE256** keep squeezing for as many bytes as you ask for: they are
*extendable-output functions* (XOFs).

**BLAKE2.** BLAKE2b (64-bit words, up to 64-byte digests) and BLAKE2s (32-bit words, up to
32 bytes) are faster than MD5 in software and as strong as SHA-3. They accept a **key**
natively, so `BLAKE2b(key, message)` is a secure MAC with no HMAC construction needed.

**CRC-32.** The input bits are treated as a polynomial over GF(2) and divided by the fixed
polynomial `0x04C11DB7`; the remainder is the checksum. In practice this is a table lookup
per byte. **Adler-32** keeps two running sums modulo 65521: `A` (1 plus the sum of the bytes)
and `B` (the sum of every `A`), and outputs `B × 65536 + A`.

## Which hash to use

| Hash | Digest | Status | Use it for |
|---|---|---|---|
| [MD5](../reference/ops/md5.md) | 128 bits | **broken**: collisions in seconds | matching legacy file IDs only |
| [SHA-1](../reference/ops/sha1.md) | 160 bits | **broken**: practical collisions since 2017 (SHAttered) | legacy Git object IDs, old certificates |
| [SHA-2](../reference/ops/sha2.md) | 224–512 bits | secure | the default: file hashes, signatures, TLS |
| [SHA-3](../reference/ops/sha3.md) | 224–512 bits | secure | a different design, as a hedge against SHA-2 |
| [SHAKE](../reference/ops/shake.md) | any length | secure | variable-length output, KDF building blocks |
| [BLAKE2b](../reference/ops/blake2b.md) / [BLAKE2s](../reference/ops/blake2s.md) | up to 512 / 256 bits | secure | fast hashing, keyed MACs (Argon2 uses BLAKE2b) |
| [CRC-32](../reference/ops/crc32.md) | 32 bits | not cryptographic | Zip, gzip, PNG, Ethernet error checks |
| [Adler-32](../reference/ops/adler32.md) | 32 bits | not cryptographic | the zlib checksum |

UniChef marks MD5 and SHA-1 with an "insecure" warning, and still computes them, because
investigations need them: VirusTotal, old databases and many protocols still use them.

## Hashes are over bytes

A digest is computed over bytes, so the same visible text can have different digests:
- `café` in UTF-8 and in Latin-1;
- precomposed and decomposed `é`;
- a trailing newline: `echo abc | md5sum` hashes `abc\n`, not `abc`;
- Windows CRLF against Unix LF line endings.

When digests disagree, look at the bytes with [To Hex](../reference/ops/to-hex.md) before
anything else. See [text and bytes](text-and-bytes.md).

## Passwords are different

Fast hashes are the wrong tool for storing passwords: a GPU computes billions of SHA-256
digests per second, so a leaked table of unsalted hashes falls to a dictionary attack.
Password storage needs a deliberately slow, salted function: see
[HMAC and key derivation](hmac-and-key-derivation.md).

<!-- docs:ops -->
Operations explained here: [Adler-32](../reference/ops/adler32.md), [BLAKE2b](../reference/ops/blake2b.md), [BLAKE2s](../reference/ops/blake2s.md), [CRC-32](../reference/ops/crc32.md), [MD5](../reference/ops/md5.md), [SHA-1](../reference/ops/sha1.md), [SHA-2](../reference/ops/sha2.md), [SHA-3](../reference/ops/sha3.md), [SHAKE](../reference/ops/shake.md).
<!-- /docs:ops -->

## Learn more

- [FIPS 180-4: SHA-1 and SHA-2](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [FIPS 202: SHA-3 and SHAKE](https://csrc.nist.gov/pubs/fips/202/final)
- [RFC 7693: BLAKE2](https://www.rfc-editor.org/rfc/rfc7693)
- [RFC 1321: MD5](https://www.rfc-editor.org/rfc/rfc1321)
- [SHAttered: the first SHA-1 collision](https://shattered.io/)
- [A painless guide to CRC error detection algorithms](https://zlib.net/crc_v3.txt)

<!-- docs:nav -->
---

[← Web encodings](web-encodings.md) · [Contents](../README.md) · [HMAC and key derivation →](hmac-and-key-derivation.md)
<!-- /docs:nav -->
