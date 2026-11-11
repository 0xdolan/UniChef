<!-- docs:crumbs -->
[Docs](../README.md) › Learn
<!-- /docs:crumbs -->

# Encryption

Encryption turns **plaintext** into **ciphertext** that reveals nothing without the **key**.
UniChef implements AES, the symmetric cipher behind TLS, disk encryption, Wi-Fi and most file
formats, plus JSON Web Tokens and a secure random generator. Symmetric means the same key
encrypts and decrypts.

## AES, the block cipher

AES (FIPS 197) encrypts one **16-byte block** at a time with a 128-, 192- or 256-bit key (16,
24 or 32 bytes). The block is arranged as a 4×4 grid of bytes, and each round applies:

1. **SubBytes:** replace every byte through a fixed table (the S-box). This is the non-linear
   step.
2. **ShiftRows:** rotate row *r* of the grid left by *r* positions.
3. **MixColumns:** mix each column by multiplying it by a fixed matrix over GF(2⁸), so every
   output byte depends on all four input bytes.
4. **AddRoundKey:** XOR the grid with a round key derived from the main key (the key
   schedule).

There are 10, 12 or 14 rounds for 128-, 192- and 256-bit keys. After two rounds every output
bit depends on every input bit. No practical attack on full AES is known: the threats are
how it is used, not AES itself.

## Modes of operation

A block cipher alone encrypts exactly 16 bytes. A **mode** says how to encrypt longer
messages. The choice matters more than the key size.

| Mode | How it works | Needs | Notes |
|---|---|---|---|
| **ECB** | each block encrypted on its own | padding | **insecure**: equal plaintext blocks give equal ciphertext blocks |
| **CBC** | XOR each plaintext block with the previous ciphertext block (the IV for the first), then encrypt | a random, unpredictable 16-byte IV, padding | no integrity: vulnerable to padding-oracle attacks if errors leak |
| **CTR** | encrypt a counter (nonce ‖ block number) and XOR the result with the plaintext, like a stream cipher | a nonce that is **never reused** with the same key | no padding; no integrity; bit flips in ciphertext flip the same plaintext bits |
| **GCM** | CTR mode plus a GHASH authentication tag over the ciphertext and extra data (AAD) | a 12-byte nonce, never reused | **authenticated**: decryption fails if anything was changed. The default choice. |

**ECB shows patterns.** Encrypting a bitmap in ECB mode leaves the outline of the picture
visible (the "ECB penguin"), and repeated 16-byte blocks in a ciphertext are a sign of ECB.
UniChef warns when you use it.

**Padding.** CBC and ECB need the plaintext to be a whole number of blocks. **PKCS#7** adds
*n* bytes of value *n*: a 14-byte message gets `02 02`, and a message that is already a
multiple of 16 gets a full block of `10`s. Decryption checks and removes it. A server that
tells you "bad padding" separately from "bad data" is a **padding oracle**, which lets an
attacker decrypt CBC ciphertext byte by byte.

**Nonce reuse.** In CTR and GCM, reusing a nonce with the same key gives the same keystream,
so XOR-ing two ciphertexts gives the XOR of the two plaintexts. In GCM it also leaks the
authentication key. Generate nonces randomly or from a counter, never by hand.

**Worked example.** In [AES Encrypt](../reference/ops/aes-encrypt.md), mode CBC, key
`000102…0f`, IV `0f0e…00`, the 14 bytes of `Attack at dawn` are padded with `02 02` to one
block, XOR-ed with the IV and encrypted, giving one 16-byte ciphertext block.
[AES Decrypt](../reference/ops/aes-decrypt.md) with the same arguments reverses it.

## Keys from passwords

AES keys are random bytes, not passwords. Turn a password into a key with
[PBKDF2](../reference/ops/pbkdf2.md) and a salt: see
[HMAC and key derivation](hmac-and-key-derivation.md). Generate keys, IVs and nonces with
[Generate Random Bytes](../reference/ops/generate-random-bytes.md), which uses the platform's
cryptographic random generator.

## JSON Web Tokens

A **JWT** (RFC 7519) is three base64url parts joined by dots: a JSON **header**, a JSON
**payload** of claims, and a **signature** over the first two:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOiJ6b2UiLCJuYW1lIjoiWm_DqyJ9 . LnREL73…
{"alg":"HS256","typ":"JWT"}            {"sub":"zoe","name":"Zoë"}             HMAC-SHA256
```

The payload is **signed, not encrypted**: anyone can read it with
[JWT Decode](../reference/ops/jwt-decode.md). The `alg` header names the algorithm: `HS256`
is HMAC-SHA-256 with a shared secret, `RS256` and `PS256` are RSA signatures, `ES256` is
ECDSA and `EdDSA` is Ed25519.

Classic JWT vulnerabilities come from trusting the header:
- **`alg: none`**: a token with no signature accepted as valid;
- **algorithm confusion**: a server that verifies `RS256` tokens with a public key is sent an
  `HS256` token "signed" with that public key as the HMAC secret;
- **weak HMAC secrets**, which can be brute-forced offline from a single token.

[JWT Verify](../reference/ops/jwt-verify.md) requires the algorithm you name, so it refuses
both tricks. [JWT Sign](../reference/ops/jwt-sign.md) creates tokens for testing.

<!-- docs:ops -->
Operations explained here: [AES Decrypt](../reference/ops/aes-decrypt.md), [AES Encrypt](../reference/ops/aes-encrypt.md), [Generate Random Bytes](../reference/ops/generate-random-bytes.md), [JWT Decode](../reference/ops/jwt-decode.md), [JWT Sign](../reference/ops/jwt-sign.md), [JWT Verify](../reference/ops/jwt-verify.md).
<!-- /docs:ops -->

## Learn more

- [FIPS 197: AES](https://csrc.nist.gov/pubs/fips/197/final)
- [NIST SP 800-38A: block cipher modes](https://csrc.nist.gov/pubs/sp/800/38/a/final)
- [NIST SP 800-38D: GCM](https://csrc.nist.gov/pubs/sp/800/38/d/final)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 8725: JWT best current practices](https://www.rfc-editor.org/rfc/rfc8725)
- [A Stick Figure Guide to AES](https://www.moserware.com/2009/09/stick-figure-guide-to-advanced.html)
- [Cryptopals challenges](https://cryptopals.com/), for hands-on attacks on these mistakes

<!-- docs:nav -->
---

[← HMAC and key derivation](hmac-and-key-derivation.md) · [Contents](../README.md) · [Classical ciphers and XOR →](classical-ciphers.md)
<!-- /docs:nav -->
