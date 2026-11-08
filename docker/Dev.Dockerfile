# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: GPL-3.0-or-later
# Local CI parity (PRD §11.7). `dev` runs the Makefile; `runtime` ships the CLI wheel.
ARG UBUNTU=24.04
FROM node:24-bookworm-slim AS node

FROM ubuntu:${UBUNTU} AS dev
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 PYTHONDONTWRITEBYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git git-lfs make curl xz-utils \
      python3 python3-venv python3-dev \
      librsvg2-bin imagemagick \
      devscripts debhelper dh-python pybuild-plugin-pyproject python3-all python3-hatchling \
      python3-rich python3-regex python3-cryptography python3-pytest python3-hypothesis \
      lintian autopkgtest dput gnupg shellcheck \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack && corepack enable
# oxipng (PRD §9.2, §11.7) is not in the 24.04 archive: install the pinned static
# release and check its checksum.
ARG OXIPNG=10.2.1
RUN set -eu; \
    case "$(uname -m)" in \
      x86_64) arch=x86_64-unknown-linux-musl; sum=1813750ef592c5350ca79c88f98b2c0876d05c826dc7156245256d4255c1ad17 ;; \
      aarch64) arch=aarch64-unknown-linux-musl; sum=ff21aa2a005b324c8dfbdf13cd2f469fb6728b27dacded82635824ecd12e3b35 ;; \
      *) echo "no oxipng build for $(uname -m)" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/oxipng.tgz "https://github.com/shssoichiro/oxipng/releases/download/v${OXIPNG}/oxipng-${OXIPNG}-${arch}.tar.gz"; \
    echo "${sum}  /tmp/oxipng.tgz" | sha256sum -c -; \
    tar -xzf /tmp/oxipng.tgz -C /usr/local/bin --strip-components=1 "oxipng-${OXIPNG}-${arch}/oxipng"; \
    rm /tmp/oxipng.tgz; oxipng --version
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /uvx /usr/local/bin/
RUN userdel -r ubuntu && useradd -m -u 1000 dev
USER dev
# Named volumes copy these directories' ownership, so the caches stay writable.
RUN mkdir -p /home/dev/.cache/uv /home/dev/.local/share/pnpm
# Keep the container's environments out of the bind-mounted checkout, so they never
# clobber the host's .venv or node_modules.
ENV UV_PROJECT_ENVIRONMENT=/home/dev/venv
WORKDIR /workspace

FROM python:3.12-slim AS runtime
COPY dist/python/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl && useradd -m app
USER app
ENTRYPOINT ["unichef"]
