// SPDX-License-Identifier: GPL-3.0-or-later
/** UI strings (NFR-042). Every visible string goes through `t()` so locales can be added. */

import en from './en.json';

export type MessageKey = keyof typeof en;

const messages: Readonly<Record<MessageKey, string>> = en;

/** The message for `key` with `{name}` placeholders filled from `vars`. */
export function t(key: MessageKey, vars: Readonly<Record<string, string | number>> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
