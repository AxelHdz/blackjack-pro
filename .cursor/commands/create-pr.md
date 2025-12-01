# Create Pull Request

Create a pull request from the current branch to the main branch.

## Instructions

When the user runs this command:

1. **Check the current branch**:
   - Get the current branch name using `git branch --show-current`
   - If on `main` or `master`, inform the user they need to switch to a feature branch first

2. **Check if branch is pushed**:
   - Check if the branch exists on remote
   - If not, push the branch: `git push -u origin <branch-name>`

3. **Verify GitHub CLI**:
   - Check if `gh` is installed (`which gh`)
   - Check authentication (`gh auth status`)
   - If missing, provide installation/authentication instructions

4. **Create the PR**:
   - Generate a default PR title from the branch name
   - Ask the user for PR title (suggest the default)
   - Ask the user for PR description (optional)
   - Run: `gh pr create --base main --head <current-branch> --title "<title>" --body "<description>"`
   - Display the PR URL
   - Ask if user wants to open it in browser (`gh pr view --web`)

## Requirements

- GitHub CLI (`gh`) installed and authenticated
- Current branch must not be `main` or `master`
