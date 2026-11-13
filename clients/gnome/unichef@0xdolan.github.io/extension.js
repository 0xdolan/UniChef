// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * UniChef for GNOME Shell (FR-016): a top-bar popup with two tabs. Convert runs one
 * operation on the input; Character lists each character's code point, name and category.
 * Both run the installed `unichef` CLI, so nothing leaves the machine (SEC-001).
 */

/* global console -- GJS provides it. */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import {
  MAX_INPUT_BYTES,
  WEB_APP_URL,
  asCodePoints,
  asUnicodeEscapes,
  filterOps,
  formatResult,
  inspectArgv,
  opArgv,
  opsArgv,
  parseCharacters,
  parseEnvelope,
  parseOps,
  utf8Length,
  visibleChar,
} from './lib.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const DEBOUNCE_MS = 350;
const DEFAULT_OP = 'from-base64';

/** The `unichef` CLI: on PATH, or where pipx and uv install it. */
function findCli() {
  const onPath = GLib.find_program_in_path('unichef');
  if (onPath !== null) return onPath;
  const local = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'unichef']);
  return GLib.file_test(local, GLib.FileTest.IS_EXECUTABLE) ? local : null;
}

/** Run argv with `input` on stdin; resolve to the parsed JSON envelope. */
async function runCli(argv, input, cancellable) {
  const proc = Gio.Subprocess.new(
    argv,
    Gio.SubprocessFlags.STDIN_PIPE |
      Gio.SubprocessFlags.STDOUT_PIPE |
      Gio.SubprocessFlags.STDERR_PIPE,
  );
  const [stdout, stderr] = await proc.communicate_utf8_async(input, cancellable);
  return parseEnvelope(stdout ?? '', stderr ?? '');
}

function multilineEntry(hint) {
  const entry = new St.Entry({ hint_text: hint, can_focus: true, style_class: 'unichef-entry' });
  entry.clutter_text.set_single_line_mode(false);
  entry.clutter_text.set_line_wrap(true);
  entry.clutter_text.set_activatable(false);
  return entry;
}

function scroller(child, styleClass) {
  const view = new St.ScrollView({
    style_class: styleClass,
    hscrollbar_policy: St.PolicyType.NEVER,
    vscrollbar_policy: St.PolicyType.AUTOMATIC,
    overlay_scrollbars: true,
  });
  view.set_child(child);
  return view;
}

function button(label, onClick) {
  const b = new St.Button({ label, style_class: 'button unichef-button', can_focus: true });
  b.connect('clicked', onClick);
  return b;
}

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    _init(ext) {
      super._init(0.5, 'UniChef');
      this._ext = ext;
      this._cli = findCli();
      this._ops = [];
      this._opId = DEFAULT_OP;
      this._timeouts = new Set();
      this._cancellable = new Gio.Cancellable();
      this._clipboard = St.Clipboard.get_default();

      this.add_child(
        new St.Icon({
          gicon: Gio.icon_new_for_string(`${ext.path}/icons/unichef-symbolic.svg`),
          style_class: 'system-status-icon',
        }),
      );

      const item = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'unichef-popup',
        x_expand: true,
      });
      item.add_child(root);
      this.menu.addMenuItem(item);

      const tabs = new St.BoxLayout({ style_class: 'unichef-tabs' });
      this._convertTab = button(_('Convert'), () => this._showTab('convert'));
      this._charTab = button(_('Character'), () => this._showTab('character'));
      tabs.add_child(this._convertTab);
      tabs.add_child(this._charTab);
      root.add_child(tabs);

      this._convert = this._buildConvert();
      this._character = this._buildCharacter();
      root.add_child(this._convert);
      root.add_child(this._character);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const web = new PopupMenu.PopupMenuItem(_('Open the full UniChef web app'));
      web.connect('activate', () => Gio.AppInfo.launch_default_for_uri(WEB_APP_URL, null));
      this.menu.addMenuItem(web);

      this._showTab('convert');
      this.menu.connect('open-state-changed', (_menu, open) => {
        if (open && this._ops.length === 0) this._loadOps().catch((e) => this._fail(e));
      });
    }

    _buildConvert() {
      const box = new St.BoxLayout({ vertical: true, style_class: 'unichef-tab' });
      this._search = new St.Entry({
        hint_text: _('Search operations'),
        can_focus: true,
        style_class: 'unichef-entry',
      });
      this._search.clutter_text.connect('text-changed', () => this._renderMatches());
      box.add_child(this._search);
      this._matches = new St.BoxLayout({ vertical: true, style_class: 'unichef-matches' });
      box.add_child(this._matches);
      this._opLabel = new St.Label({ style_class: 'unichef-op' });
      box.add_child(this._opLabel);

      this._input = multilineEntry(_('Input'));
      this._input.clutter_text.connect('text-changed', () =>
        this._schedule(() => this._runConvert()),
      );
      box.add_child(scroller(this._input, 'unichef-scroll'));

      this._output = multilineEntry(_('Output'));
      this._output.clutter_text.set_editable(false);
      box.add_child(scroller(this._output, 'unichef-scroll'));
      this._note = new St.Label({ style_class: 'unichef-note' });
      this._note.clutter_text.set_line_wrap(true);
      box.add_child(this._note);

      const actions = new St.BoxLayout({ style_class: 'unichef-actions' });
      actions.add_child(
        button(_('Paste clipboard'), () =>
          this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (_c, text) => {
            if (text !== null) this._input.set_text(text);
          }),
        ),
      );
      actions.add_child(
        button(_('Copy output'), () =>
          this._clipboard.set_text(St.ClipboardType.CLIPBOARD, this._output.get_text()),
        ),
      );
      box.add_child(actions);
      return box;
    }

    _buildCharacter() {
      const box = new St.BoxLayout({ vertical: true, style_class: 'unichef-tab' });
      this._chars = new St.Entry({
        hint_text: _('Type or paste characters'),
        can_focus: true,
        style_class: 'unichef-entry',
      });
      this._chars.clutter_text.connect('text-changed', () =>
        this._schedule(() => this._runCharacter()),
      );
      box.add_child(this._chars);
      this._charList = new St.BoxLayout({ vertical: true });
      box.add_child(scroller(this._charList, 'unichef-scroll unichef-chars'));
      const actions = new St.BoxLayout({ style_class: 'unichef-actions' });
      actions.add_child(
        button(_('Copy as U+…'), () =>
          this._clipboard.set_text(
            St.ClipboardType.CLIPBOARD,
            asCodePoints(this._chars.get_text()),
          ),
        ),
      );
      actions.add_child(
        button(_('Copy as \\u…'), () =>
          this._clipboard.set_text(
            St.ClipboardType.CLIPBOARD,
            asUnicodeEscapes(this._chars.get_text()),
          ),
        ),
      );
      box.add_child(actions);
      return box;
    }

    _showTab(name) {
      const convert = name === 'convert';
      this._convert.visible = convert;
      this._character.visible = !convert;
      this._convertTab.checked = convert;
      this._charTab.checked = !convert;
      for (const [tab, on] of [
        [this._convertTab, convert],
        [this._charTab, !convert],
      ]) {
        if (on) tab.add_style_pseudo_class('checked');
        else tab.remove_style_pseudo_class('checked');
      }
    }

    /** Run `fn` once input has been still for DEBOUNCE_MS. */
    _schedule(fn) {
      for (const id of this._timeouts) GLib.Source.remove(id);
      this._timeouts.clear();
      const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DEBOUNCE_MS, () => {
        this._timeouts.delete(id);
        fn().catch((e) => this._fail(e));
        return GLib.SOURCE_REMOVE;
      });
      this._timeouts.add(id);
    }

    _missingCli() {
      if (this._cli !== null) return false;
      const text = _(
        'The unichef command was not found. Install it with "pipx install unichef" or "sudo apt install unichef".',
      );
      this._output.set_text('');
      this._note.set_text(text);
      this._charList.destroy_all_children();
      this._charList.add_child(new St.Label({ text, style_class: 'unichef-note' }));
      return true;
    }

    async _loadOps() {
      if (this._missingCli()) return;
      this._ops = parseOps(await runCli(opsArgv(this._cli), '', this._cancellable));
      this._renderMatches();
      this._renderOp();
    }

    _renderMatches() {
      this._matches.destroy_all_children();
      const query = this._search.get_text();
      if (query.trim() === '') return;
      for (const op of filterOps(this._ops, query, 6)) {
        const b = new St.Button({
          label: op.name,
          style_class: 'unichef-match',
          x_align: Clutter.ActorAlign.START,
          can_focus: true,
        });
        b.connect('clicked', () => {
          this._opId = op.id;
          this._search.set_text('');
          this._renderOp();
          this._runConvert().catch((e) => this._fail(e));
        });
        this._matches.add_child(b);
      }
    }

    _renderOp() {
      const op = this._ops.find((o) => o.id === this._opId);
      this._opLabel.set_text(`${_('Operation')}: ${op === undefined ? this._opId : op.name}`);
    }

    async _runConvert() {
      if (this._missingCli()) return;
      const input = this._input.get_text();
      if (input === '') {
        this._output.set_text('');
        this._note.set_text('');
        return;
      }
      if (utf8Length(input) > MAX_INPUT_BYTES) {
        this._note.set_text(_('The input is larger than 1 MiB; use the CLI or the web app.'));
        return;
      }
      const shown = formatResult(
        await runCli(opArgv(this._cli, this._opId), input, this._cancellable),
      );
      this._output.set_text(shown.ok ? shown.text : '');
      this._note.set_text(
        shown.ok ? shown.note : [shown.text, shown.note].filter(Boolean).join('\n'),
      );
    }

    async _runCharacter() {
      if (this._missingCli()) return;
      const text = this._chars.get_text();
      this._charList.destroy_all_children();
      if (text === '') return;
      const rows = parseCharacters(await runCli(inspectArgv(this._cli), text, this._cancellable));
      for (const row of rows) {
        const line = new St.BoxLayout({ style_class: 'unichef-char' });
        line.add_child(new St.Label({ text: row.cp, style_class: 'unichef-cp' }));
        line.add_child(new St.Label({ text: visibleChar(row), style_class: 'unichef-glyph' }));
        const name = new St.Label({
          text: `${row.name} (${row.gc})`,
          style_class: 'unichef-name',
          x_expand: true,
        });
        name.clutter_text.set_line_wrap(true);
        line.add_child(name);
        this._charList.add_child(line);
      }
    }

    _fail(error) {
      if (error instanceof GLib.Error && error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
        return;
      this._note.set_text(String(error.message ?? error));
      console.error(`UniChef: ${error}`);
    }

    destroy() {
      this._cancellable.cancel();
      for (const id of this._timeouts) GLib.Source.remove(id);
      this._timeouts.clear();
      super.destroy();
    }
  },
);

export default class UniChefExtension extends Extension {
  enable() {
    this._indicator = new Indicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    this._indicator?.destroy();
    this._indicator = null;
  }
}
