# Package Manager Configuration

## Overview

This project uses **npm** as the official package manager. This document explains the configuration and why it's important for consistent builds.

## Configuration Changes Made

### 1. Removed Conflicting Lockfiles

**Deleted**: `pnpm-lock.yaml`

**Reason**: Having multiple lockfiles (pnpm-lock.yaml + package-lock.json) causes:
- Vercel build confusion about which package manager to use
- Inconsistent dependency resolution
- Deployment failures
- Local development issues

**Kept**: `package-lock.json` (npm's lockfile)

### 2. Explicit Package Manager Declaration

**File**: `package.json`

```json
{
  "packageManager": "npm@10.9.2"
}
```

This field:
- Tells Vercel and other tools to use npm explicitly
- Specifies the exact npm version (10.9.2)
- Prevents automatic detection that could choose the wrong package manager
- Follows the [Corepack](https://nodejs.org/api/corepack.html) standard

### 3. Created `.npmrc` Configuration

**File**: `.npmrc`

```ini
# Force npm as the package manager
engine-strict=true
save-exact=false
legacy-peer-deps=false

# Vercel-specific optimizations
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000

# Security
audit-level=moderate

# Performance
prefer-offline=false
progress=true
```

#### Configuration Explained

**Core Settings**:
- `engine-strict=true`: Enforces Node.js version requirements from package.json
- `save-exact=false`: Uses semantic versioning (^version) for new packages
- `legacy-peer-deps=false`: Uses modern peer dependency resolution

**Network Resilience**:
- `fetch-retries=5`: Retries failed downloads up to 5 times
- `fetch-retry-mintimeout=20000`: Minimum 20s between retries
- `fetch-retry-maxtimeout=120000`: Maximum 120s timeout for retries

These settings help prevent transient network failures during Vercel deployments.

**Security**:
- `audit-level=moderate`: Runs security audits, warns on moderate+ vulnerabilities

**Performance**:
- `prefer-offline=false`: Always checks for updates (important for CI/CD)
- `progress=true`: Shows installation progress (helpful for debugging)

## Vercel Deployment Impact

### Before Changes

```
⚠️ Warning: Multiple lockfiles detected (pnpm-lock.yaml, package-lock.json)
⚠️ Using auto-detected package manager: pnpm
❌ Error: Dependencies mismatch with package-lock.json
```

### After Changes

```
✓ Detected package manager: npm@10.9.2 (from packageManager field)
✓ Using package-lock.json for dependency resolution
✓ Build completed successfully
```

## Local Development

### Using npm (Recommended)

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### If You Prefer Another Package Manager

While this project is configured for npm, you can use other package managers locally:

#### Using pnpm

```bash
# Remove npm lockfile
rm package-lock.json

# Create pnpm lockfile
pnpm install

# Update package.json
# Change: "packageManager": "npm@10.9.2"
# To: "packageManager": "pnpm@9.0.0"

# Vercel will now use pnpm
```

#### Using yarn

```bash
# Remove npm lockfile
rm package-lock.json

# Create yarn lockfile
yarn install

# Update package.json
# Change: "packageManager": "npm@10.9.2"
# To: "packageManager": "yarn@4.0.0"

# Vercel will now use yarn
```

#### Using bun

```bash
# Remove npm lockfile
rm package-lock.json

# Create bun lockfile
bun install

# Update package.json
# Change: "packageManager": "npm@10.9.2"
# To: "packageManager": "bun@1.0.0"

# Vercel will now use bun
```

**Important**: Only keep ONE lockfile in the repository. Multiple lockfiles will cause conflicts.

## Troubleshooting

### Issue: "Cannot find module" errors after switching package managers

**Solution**:
```bash
# Clean everything
rm -rf node_modules
rm package-lock.json

# Reinstall with npm
npm install

# Restart dev server
npm run dev
```

### Issue: Vercel deployment using wrong package manager

**Check**:
1. Verify `package.json` has `"packageManager": "npm@10.9.2"`
2. Ensure only `package-lock.json` exists (no pnpm-lock.yaml or yarn.lock)
3. Check Vercel project settings → "Install Command" is not overridden

**Fix**:
```bash
# Remove all lockfiles except npm's
rm -f pnpm-lock.yaml yarn.lock bun.lockb

# Keep package-lock.json
git add package-lock.json package.json .npmrc
git commit -m "fix: enforce npm as package manager"
git push
```

### Issue: "Package manager mismatch" warning

**Cause**: Your global npm version differs from the specified version

**Solution**:
```bash
# Update npm globally
npm install -g npm@10.9.2

# Or use npx to use the correct version automatically
npx npm@10.9.2 install
```

### Issue: Slow npm installs on Vercel

**Already Configured**: The `.npmrc` file includes optimizations:
- Retry logic for transient failures
- Extended timeouts for large packages

**Additional Optimization**:
```bash
# In Vercel project settings, increase memory:
# Settings → Functions → Memory: 1024 MB
```

## Best Practices

### ✅ DO

- Commit `package-lock.json` to version control
- Use `npm ci` in CI/CD pipelines (faster, more reliable)
- Run `npm audit` regularly to check for vulnerabilities
- Keep npm updated: `npm install -g npm@latest`

### ❌ DON'T

- Mix package managers (one project = one package manager)
- Commit `node_modules/` to version control
- Manually edit `package-lock.json`
- Use `npm install` in CI/CD (use `npm ci` instead)
- Keep multiple lockfiles in the repository

## Package Manager Comparison

| Feature | npm | pnpm | yarn | bun |
|---------|-----|------|------|-----|
| Speed | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Disk Space | Medium | Excellent | Medium | Good |
| Monorepo Support | Good | Excellent | Excellent | Good |
| Compatibility | Excellent | Good | Excellent | Good |
| Vercel Support | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| Maturity | Mature | Mature | Mature | Beta |

**Why npm for this project?**
- Universal compatibility - works everywhere
- Native Node.js integration
- Well-documented and widely adopted
- Excellent Vercel support
- No learning curve for team members

## Migration History

### Feb 19, 2026

**Issue**: Multiple lockfiles causing Vercel build failures

**Changes**:
1. Removed `pnpm-lock.yaml` (conflicting with npm)
2. Added `"packageManager": "npm@10.9.2"` to package.json
3. Created `.npmrc` with optimized configuration

**Result**: 
- Resolved Vercel deployment inconsistencies
- Improved build reliability
- Standardized development environment

## References

- [npm Documentation](https://docs.npmjs.com/)
- [Vercel Build Configuration](https://vercel.com/docs/projects/project-configuration)
- [Corepack - Package Manager Manager](https://nodejs.org/api/corepack.html)
- [npm Configuration Options](https://docs.npmjs.com/cli/v10/using-npm/config)

## Support

If you encounter package manager issues:

1. Check this document first
2. Review Vercel build logs for specific errors
3. Run `npm cache clean --force` to clear npm cache
4. Delete `node_modules/` and `package-lock.json`, then `npm install`
5. Check Node.js version compatibility: `node --version` (should be 18+ or 20+)

## Summary

This project now exclusively uses **npm** with an explicit configuration that ensures:
- Consistent builds across local development and Vercel deployments
- No package manager conflicts
- Optimized network resilience
- Security audit integration
- Clear upgrade path for dependencies

All team members should use `npm` commands for package management to maintain consistency.
