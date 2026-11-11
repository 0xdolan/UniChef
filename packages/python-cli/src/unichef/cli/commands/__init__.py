# SPDX-License-Identifier: GPL-3.0-or-later
"""Every CLI command, in help-tree order."""

from unichef.cli.commands import characters, security, transform, utilities

COMMANDS = (*transform.COMMANDS, *characters.COMMANDS, *security.COMMANDS, *utilities.COMMANDS)
