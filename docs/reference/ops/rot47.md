<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Crypto

# ROT47

Rotate printable ASCII U+0021..U+007E by `amount` (default 47) mod 94.

| Id | Input | Output | Background |
|---|---|---|---|
| `rot47` | string | string | [Classical ciphers and XOR](../../learn/classical-ciphers.md) |
<!-- /docs:head -->

## How it works

ROT47 rotates all 94 printable ASCII characters from `!` (U+0021) to `~` (U+007E), not only
letters: each one is replaced by the character `amount` places later, wrapping around after
`~`. With the default 47, half of 94, it is its own inverse.

**Worked example.** `Hello, World!` becomes `w6==@[ (@C=5P`. For `H` (72): subtract 33 to get
its position 39 in the range, add 47 to get 86 (mod 94), and add 33 back: 119, which is `w`.
For `o` (111): (78 + 47) mod 94 = 31, plus 33 is 64, `@`. The space is outside the range and
stays.

Because digits and punctuation change too, ROT47 output looks like random symbols, which is
why it shows up in simple obfuscation and CTF puzzles.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `amount` | integer -1000000 to 1000000 | `47` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `Hello, World!` | — | `w6==@[ (@C=5P` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqyi8xMVfSUUosSgeKVtfWxtYCAA&i=80jNycnXUQjPL8pJUQQA), or search for "ROT47" in the operation list.

**CLI:**

```sh
unichef op rot47 'Hello, World!'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("rot47", {}, Dish.of_string("Hello, World!"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("rot47", {}, { type: 'string', value: "Hello, World!" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [ROT47 on Wikipedia](https://en.wikipedia.org/wiki/ROT13#Variants)
- Related: [ROT13](rot13.md), [Atbash](atbash.md), [Classical ciphers](../../learn/classical-ciphers.md)

<!-- docs:nav -->
---

[← ROT13](rot13.md) · [Contents](../../README.md) · [ROT8000 →](rot8000.md)
<!-- /docs:nav -->
