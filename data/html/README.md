# HTML named character references

`entities.json` is the WHATWG list of named character references, committed unmodified so builds work offline. `entities.lock.json` pins its URL and SHA-256.

```sh
make entities         # uv run scripts/html/build.py: verify the hash, write html-entities.json.gz to both packages
make entities-check   # rebuild in memory and fail on drift (part of make ci)
uv run scripts/html/build.py --fetch   # download over HTTPS, verify against the lock, then build
```

- The artefact is `{"entities": {"AElig;": [198], ...}, "sha256": ..., "url": ...}`: names without the leading `&`, including the 106 legacy names without a semicolon.
- The output is deterministic, as for the UCD artefacts: sorted keys, compact JSON, gzip level 9 with `mtime=0`. The gzip budget is 32 KiB.
- To accept a new upstream list on purpose, update the hash in the lock, run `make entities`, and review the vector results.

Licence: CC BY 4.0 (see `THIRD_PARTY_NOTICES.md`).
