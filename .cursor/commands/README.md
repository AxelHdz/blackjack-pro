# Cursor Commands

This directory contains custom Cursor commands for the project.

## Available Commands

### `create-pr.md`

Creates a pull request from the current branch to the main branch.

**Usage:**
Use `@create-pr` in Cursor chat or `/create-pr` command.

**Features:**
- Automatically detects current branch
- Pushes branch to remote if needed
- Creates PR using GitHub CLI
- Interactive prompts for PR title and description
- Opens PR in browser (optional)

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Current branch must not be `main` or `master`

**Installation:**
1. Install GitHub CLI: https://cli.github.com/
2. Authenticate: `gh auth login`

## Adding New Commands

To add a new command:
1. Create a new `.md` file in this directory
2. Follow the format of existing commands
3. Update this README with documentation

