// SPDX-License-Identifier: GPL-3.0-or-later
/** The licence list `vite.licenses.ts` generates at build time (its `Licence` type). */
declare module 'virtual:licenses' {
  const licences: readonly {
    readonly name: string;
    readonly version: string;
    readonly license: string;
    readonly text: string;
  }[];
  export default licences;
}
