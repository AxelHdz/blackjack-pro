# Pre-Commit Static Checks

Run a project-wide static check to catch implicit any/type-guard issues and React purity violations.

## Commands (run from repo root)

1. **ESLint React purity errors:**
   ```bash
   pnpm run lint
   ```

2. **TypeScript/implicit any and type-guard mismatches:**
   ```bash
   pnpm run build
   ```

**Note:** Stop after the first failing command.
