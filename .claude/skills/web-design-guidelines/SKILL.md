---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the rules from [guidelines.md](guidelines.md) in this skill directory
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

The rules are vendored locally in [guidelines.md](guidelines.md) (copy of
`vercel-labs/web-interface-guidelines` `command.md`, see `.claude/skills/README.md`).
They are not fetched at runtime, so a review always uses the reviewed, pinned rule set.

## Usage

When a user provides a file or pattern argument:
1. Read [guidelines.md](guidelines.md)
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
