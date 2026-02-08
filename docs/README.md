# Technical Documentation

**NFC Assistant - Troubleshooting & Technical Guides**

This directory contains all technical troubleshooting guides, error resolution documentation, and implementation references for the NFC Assistant project.

---

## Quick Navigation

### 🔧 Troubleshooting Guides

**Start here when encountering errors:**

- **[TypeScript Troubleshooting](./TYPESCRIPT_TROUBLESHOOTING.md)** - All TypeScript type errors, interface extensions, and null safety patterns
- **[LanguageModel Troubleshooting](./LANGUAGEMODEL_TROUBLESHOOTING.md)** - AI SDK version compatibility, model type issues, and adapter utilities

### 🛠️ Specific Issues

- **[Preview Mode Fix](./PREVIEW_MODE_FIX.md)** - Browser restrictions in v0 embedded preview
- **[MaxOutputTokens Error](./MAXOUTPUTTOKENS_ERROR_RESOLUTION.md)** - Token limit configuration issues
- **[AI SDK 6 Upgrade](./AI_SDK_6_UPGRADE.md)** - Migration guide for AI SDK version 6

### 📦 Archive

- **[archive/](./archive/)** - Historical documentation and meta-guides

---

## Documentation Structure

```
docs/
├── README.md                              # This file
├── TYPESCRIPT_TROUBLESHOOTING.md          # TypeScript errors (consolidated)
├── LANGUAGEMODEL_TROUBLESHOOTING.md       # AI SDK model types (consolidated)
├── PREVIEW_MODE_FIX.md                    # Preview browser restrictions
├── MAXOUTPUTTOKENS_ERROR_RESOLUTION.md    # Token limit issues
├── AI_SDK_6_UPGRADE.md                    # SDK upgrade guide
└── archive/
    └── DOCUMENTATION_CONSOLIDATION.md     # Consolidation history
```

---

## Common Issues Quick Reference

### TypeScript Errors

| Error | Guide | Section |
|-------|-------|---------|
| Property does not exist on type | [TypeScript](./TYPESCRIPT_TROUBLESHOOTING.md) | APIResponse Type Extensions |
| Type 'undefined' not assignable to 'string' | [TypeScript](./TYPESCRIPT_TROUBLESHOOTING.md) | Supabase Client Types |
| Object is possibly 'null' | [TypeScript](./TYPESCRIPT_TROUBLESHOOTING.md) | Optional Property Safety |

### AI SDK Issues

| Error | Guide | Section |
|-------|-------|---------|
| LanguageModelV1 not assignable to LanguageModel | [LanguageModel](./LANGUAGEMODEL_TROUBLESHOOTING.md) | Problem Overview |
| Property 'supportedUrls' missing | [LanguageModel](./LANGUAGEMODEL_TROUBLESHOOTING.md) | Type Extensions |
| Model version compatibility | [LanguageModel](./LANGUAGEMODEL_TROUBLESHOOTING.md) | Migration Guide |

### Runtime Issues

| Issue | Guide | Section |
|-------|-------|---------|
| Preview not showing | [Preview Mode](./PREVIEW_MODE_FIX.md) | Solution Overview |
| MaxOutputTokens error | [MaxOutputTokens](./MAXOUTPUTTOKENS_ERROR_RESOLUTION.md) | Quick Fix |
| SDK upgrade needed | [AI SDK 6](./AI_SDK_6_UPGRADE.md) | Migration Steps |

---

## Using These Guides

### 1. Error Message Search
Use your error message to find the relevant guide:
- TypeScript errors → TypeScript Troubleshooting
- LanguageModel errors → LanguageModel Troubleshooting
- Runtime/browser errors → Preview Mode Fix

### 2. Problem Category
If you know the general area:
- Type safety issues → TypeScript guide
- AI SDK integration → LanguageModel guide
- Preview/deployment → Preview Mode or MaxOutputTokens guides

### 3. Learning Resources
For understanding patterns and best practices:
- Read the "Best Practices" sections in each guide
- Check "Quick Reference" sections for common patterns
- Review code examples for implementation guidance

---

## Contributing to Documentation

When adding new documentation:

1. **Technical troubleshooting** → Add to `docs/` directory
2. **Project information** → Update main `README.md` in root
3. **API documentation** → Consider inline JSDoc comments
4. **Outdated guides** → Move to `archive/` instead of deleting

### Documentation Standards

- **Use clear headings** - H2 for major sections, H3 for subsections
- **Include code examples** - Show both problem and solution
- **Add quick reference** - Summary tables for common issues
- **Cross-link related docs** - Help users find related information
- **Update table of contents** - Keep navigation current

---

## Related Resources

### Main Documentation
- [Complete Documentation](../COMPLETE_DOCUMENTATION.md) - Comprehensive project guide
- [Refactoring Changelog](../REFACTORING_CHANGELOG.md) - Recent organizational changes
- [README](../README.md) - Project overview and setup

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [AI SDK Documentation](https://sdk.vercel.ai)
- [Supabase Documentation](https://supabase.com/docs)

---

## Recent Changes

**February 7, 2026** - Major documentation consolidation:
- Merged 3 TypeScript docs into single comprehensive guide
- Merged 5 LanguageModel docs into unified troubleshooting guide
- Organized technical docs into `docs/` directory
- Created this index for easier navigation

See [Refactoring Changelog](../REFACTORING_CHANGELOG.md) for complete details.

---

## Getting Help

If you can't find what you need:

1. **Search the consolidated guides** - Use Cmd/Ctrl+F to search within files
2. **Check code comments** - Implementation files have JSDoc documentation
3. **Review git history** - Previous solutions may be in commit messages
4. **Check TypeScript errors** - Error messages often include helpful hints

---

**Last Updated:** February 7, 2026
