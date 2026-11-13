<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Encoding

# From Modhex

Read Modhex digit pairs, in either case, ignoring whitespace. `auto` also drops every other character; any other choice removes only that delimiter.

| Id | Input | Output | Background |
|---|---|---|---|
| `from-modhex` | string | bytes | [Base encodings](../../learn/base-encodings.md) |
<!-- /docs:head -->

## How it works

`from-modhex` turns Modhex text back into bytes: each pair of letters from `cbdefghijklnrtuv`
is one byte, with `c` = 0 through `v` = 15.

**Worked example: `fj hk db`**

`fj` is 4, 9 = 0x48 (`H`); `hk` is 6, 9 = 0x69 (`i`); `db` is 2, 1 = 0x21 (`!`). Result: `Hi!`.

Upper case is accepted and whitespace is ignored. With `delimiter` set to `auto`, every
character that is not a Modhex letter is dropped first; with a named delimiter only that
delimiter is removed, so a stray character is an error. An odd number of letters is an error.

<!-- docs:usage -->
## Arguments

| Name | Type | Default | Values |
|---|---|---|---|
| `delimiter` | choice | `auto` | `auto`, `space`, `percent`, `comma`, `semicolon`, `colon`, `newline`, `crlf`, `none` |

## Examples

| Input | Arguments | Output |
|---|---|---|
| `fj hk db` | — | `Hi!` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslJKK8rP1c3NT8lIrVDSUUosSgfKVdfWxtYCAA&i=S8tSyMhWSEkCAA), or search for "From Modhex" in the operation list.

**CLI:**

```sh
unichef op from-modhex 'fj hk db'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("from-modhex", {}, Dish.of_string("fj hk db"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("from-modhex", {}, { type: 'string', value: "fj hk db" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Modhex (Yubico developer docs)](https://developers.yubico.com/OTP/Modhex_Converter.html)
- [YubiKey OTP (Yubico)](https://developers.yubico.com/OTP/OTPs_Explained.html)
- Related: [To Modhex](to-modhex.md), [From Hex](from-hex.md)

<!-- docs:nav -->
---

[← From Hex](from-hex.md) · [Contents](../../README.md) · [From Morse code →](from-morse-code.md)
<!-- /docs:nav -->
