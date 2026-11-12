<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Base92

Decode Base92. Without `strict`, it skips characters outside the alphabet.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-base92` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

Each character's position in the alphabet (`!`, `#` to `_`, `a` to `}`) is a digit from 0
to 90. The decoder takes **two characters** at a time, computes first × 91 + second and
appends the result as **13 bits**. A final single character appends **6 bits**. Every full
group of 8 bits is one output byte, and the padding bits left at the end are dropped.

`;K_$aOB` gives 2316, 5553 and 5687 (13 bits each) and then 32 (6 bits): 45 bits, of which
the first 40 are `Hello`.

These inputs are errors (`E_DECODE`):

- a pair whose value is above 8191, such as `}}`;
- a final single character above 63.

Without `strict`, characters outside the alphabet, such as spaces, line breaks and `~`, are
skipped. With `strict`, any such character is an error.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `strict` | boolean | `false` | — |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `;K_$aOB` | — | `Hello` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1U1KLE61NFLSUUosSgfKVdfWxtYCAA&i=s_aOV0n0dwIA), or search for "From Base92" in the operation list.

**CLI:**

```sh
unichef op from-base92 ';K_$aOB'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-base92", {}, Dish.of_string(";K_$aOB"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-base92", {}, { type: 'string', value: ";K_$aOB" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [base92: the reference implementation and format notes](https://github.com/thenoviceoof/base92)
- Related: [To Base92](to-base92.md), [From Base85](from-base85.md)

<!-- docs:nav -->
---

[← From Base85](from-base85.md) · [Contents](../../README.md) · [From Binary →](from-binary.md)
<!-- /docs:nav -->
