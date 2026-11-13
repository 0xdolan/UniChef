<!-- docs:head -->
[Docs](../../README.md) › [Reference](../README.md) › Text

# Remove null bytes

Remove every 0x00 byte.

| Id | Input | Output | Background |
|---|---|---|---|
| `remove-null-bytes` | bytes | bytes | [Data formats and text processing](../../learn/data-and-text.md) |
<!-- /docs:head -->

## How it works

`remove-null-bytes` deletes every byte with the value 0x00 and keeps all others.

**Worked example:** UTF-16LE text `Hi` is the bytes `48 00 69 00`. Removing the null bytes
leaves `48 69`, which is `Hi` in ASCII.

This is a quick way to read ASCII text stored as UTF-16, but it is not a real UTF-16
decoder: characters outside ASCII are garbled. Use
[Decode text](decode-text.md) with UTF-16 for that.

<!-- docs:usage -->
## Arguments

This operation takes no arguments.

## Examples

| Input | Arguments | Output |
|---|---|---|
| `a\u0000b\u0000` | — | `ab` |

## Use it

**Web app:** [open this example in UniChef](https://0xdolan.github.io/unichef/#/?r=q1YqSy0qzszPU7Iy1FEqLkktKFayiq5Wyi9QslIqSs3NL0vVzSvNydFNqixJLVbSUUosSgeqqK6tja0FAA&i=S2RIYgAA), or search for "Remove null bytes" in the operation list.

**CLI:**

```sh
unichef op remove-null-bytes $'a\u0000b\u0000'
```

**Python:**

```python
from unichef.core.dish import Dish
from unichef.core.runner import run_operation

result = run_operation("remove-null-bytes", {}, Dish.of_string("a\u0000b\u0000"))
print(result.dish.value)
```

**TypeScript:**

```ts
import { runOperation } from '@unichef/core';

const result = await runOperation("remove-null-bytes", {}, { type: 'string', value: "a\u0000b\u0000" });
console.log(result.dish.value);
```
<!-- /docs:usage -->

## Learn more

- [Null character (Wikipedia)](https://en.wikipedia.org/wiki/Null_character)
- Related: [Decode text](decode-text.md)

<!-- docs:nav -->
---

[← Remove line numbers](remove-line-numbers.md) · [Contents](../../README.md) · [Reverse →](reverse.md)
<!-- /docs:nav -->
