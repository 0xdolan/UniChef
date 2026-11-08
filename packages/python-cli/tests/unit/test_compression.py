# SPDX-License-Identifier: GPL-3.0-or-later
"""Compression ops: what the shared vectors cannot carry (output limits, large inputs)."""

import gzip
import zlib

import pytest

from unichef.core.dish import Dish
from unichef.core.errors import UniChefError
from unichef.core.ops.compression import _inflate_raw
from unichef.core.registry import Limits, OpContext
from unichef.core.runner import run_operation


def _raw(data: bytes) -> bytes:
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    return comp.compress(data) + comp.flush()


def test_inflate_stops_at_the_limit() -> None:
    bomb = _raw(bytes(1 << 20))
    with pytest.raises(UniChefError) as info:
        _inflate_raw(bomb, 1000, "raw-inflate")
    assert info.value.code == "E_LIMIT"
    out, used = _inflate_raw(bomb + b"xy", 1 << 20, "raw-inflate")
    assert out == bytes(1 << 20)
    assert used == len(bomb)


def test_gunzip_members_share_the_limit() -> None:
    data = gzip.compress(bytes(80), mtime=0) * 2
    ctx = OpContext(limits=Limits(min_output_size=100, output_factor=1))
    with pytest.raises(UniChefError) as info:
        run_operation("gunzip", {}, Dish("bytes", data), ctx=ctx)
    assert info.value.code == "E_LIMIT"


def test_stored_blocks_split_at_65535() -> None:
    data = bytes(range(256)) * 300  # 76800 bytes: two stored blocks
    out = run_operation("raw-deflate", {"level": 0}, Dish("bytes", data)).dish.value
    assert isinstance(out, bytes)
    assert out[:5] == bytes.fromhex("00ffff0000")
    assert out[65540:65545] == bytes([1]) + (76800 - 65535).to_bytes(2, "little") + (
        (76800 - 65535) ^ 0xFFFF
    ).to_bytes(2, "little")
    assert zlib.decompress(out, -15) == data
