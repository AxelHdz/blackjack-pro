# Cursor Configuration

This directory contains Cursor IDE configuration files and custom commands for the project.

## Structure

```
.cursor/
├── README.md          # This file
└── commands/         # Custom Cursor commands
    └── create-pr.md  # Create PR command
```

## Commands

Custom commands are stored in the `commands/` directory. These are markdown files that provide instructions to the AI assistant for performing specific tasks.

### Available Commands

#### `commands/create-pr.md`

Creates a pull request from the current branch to the main branch.

**Usage:** Use `@create-pr` in Cursor chat or `/create-pr` command.

**Features:**
- Automatically detects current branch
- Pushes branch to remote if needed
- Creates PR using GitHub CLI
- Interactive prompts for PR title and description
- Opens PR in browser (optional)

**Requirements:**
- GitHub CLI (`gh`) installed and authenticated
- Current branch must not be `main` or `master`

### Adding New Commands

To add a new command:
1. Create a new `.md` file in the `commands/` directory
2. Follow the format of existing commands
3. Update this README with documentation

## Other Files

This directory may contain other Cursor configuration files as needed:
- `.cursorrules` - Project-specific rules for the AI assistant
- Other configuration files as Cursor evolves

