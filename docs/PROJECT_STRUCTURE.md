# Project Structure

**Visual guide to the NFC Assistant codebase organization**

---

## Directory Tree

```
v0-nfc-assistant/
│
├── 📱 app/                          # Next.js App Router
│   ├── globals.css                  # Main styles (canonical)
│   ├── layout.tsx                   # Root layout with preview banner
│   ├── page.tsx                     # Main application page
│   │
│   ├── api/                         # API routes
│   │   ├── analyze/route.ts        # AI analysis endpoint
│   │   ├── cards/route.ts          # Data cards endpoint
│   │   └── odds/route.ts           # Sports odds endpoint
│   │
│   └── [...other routes]
│
├── 🧩 components/                   # React components
│   ├── preview-mode-banner.tsx     # ✨ NEW: v0 preview notification
│   ├── data-cards/                 # Insight card components
│   └── ui/                         # shadcn/ui components
│
├── 📚 lib/                          # Utility libraries
│   ├── preview-mode.ts             # Preview detection utility
│   ├── model-adapter.ts            # AI model version adapter
│   ├── types.ts                    # Type definitions
│   ├── leveraged-ai.ts             # AI integration
│   ├── dynamic-config.ts           # Configuration management
│   │
│   └── supabase/                   # Supabase client
│       ├── client.ts               # Browser client
│       ├── server.ts               # Server client
│       └── proxy.ts                # Proxy configuration
│
├── 📘 types/                        # TypeScript declarations
│   ├── global.d.ts                 # Global type augmentations
│   └── ai-sdk-extensions.d.ts      # AI SDK type extensions
│
├── 🔧 scripts/                      # Utility scripts
│   └── verify-model-types.ts       # Type verification tests
│
├── 📖 docs/                         # ✨ NEW: Technical documentation
│   ├── README.md                   # Documentation index
│   ├── TYPESCRIPT_TROUBLESHOOTING.md        # Consolidated (3→1)
│   ├── LANGUAGEMODEL_TROUBLESHOOTING.md     # Consolidated (5→1)
│   ├── PREVIEW_MODE_FIX.md
│   ├── MAXOUTPUTTOKENS_ERROR_RESOLUTION.md
│   ├── AI_SDK_6_UPGRADE.md
│   ├── PROJECT_STRUCTURE.md        # This file
│   │
│   └── archive/                    # Historical documentation
│       └── DOCUMENTATION_CONSOLIDATION.md
│
├── 📄 Root Documentation           # Essential project docs
│   ├── README.md                   # Project overview
│   ├── COMPLETE_DOCUMENTATION.md   # Comprehensive guide
│   ├── SUPABASE_SETUP.md          # Database setup
│   ├── LEVERAGED_AI_INTEGRATION.md
│   ├── IMPLEMENTATION_COMPLETE.md
│   ├── JSON_ERROR_PREVENTION_FIXES.md
│   │
│   └── 📋 Refactoring Docs        # Recent cleanup
│       ├── REFACTORING_CHANGELOG.md    # Detailed change log
│       ├── REFACTORING_SUMMARY.md      # Quick reference
│       └── REFACTORING_VERIFICATION.md # Verification checklist
│
├── ⚙️ Configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   └── tailwind.config.ts
│
└── 🗑️ Removed                       # Files deleted in refactoring
    ├── ❌ styles/globals.css       # Duplicate CSS
    ├── ❌ TYPESCRIPT_FIXES.md
    ├── ❌ TYPESCRIPT_ERROR_FIXES.md
    ├── ❌ TYPESCRIPT_FIX_SUMMARY.md
    ├── ❌ LANGUAGEMODELV1_ERROR_ANALYSIS.md
    ├── ❌ LANGUAGEMODEL_VERSION_COMPATIBILITY.md
    ├── ❌ LANGUAGEMODEL_FIX_IMPLEMENTATION.md
    ├── ❌ LANGUAGEMODEL_MIGRATION_GUIDE.md
    └── ❌ LANGUAGEMODEL_QUICK_REFERENCE.md
```

---

## Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      app/layout.tsx                         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  <html>                                               │ │
│  │    <body>                                             │ │
│  │      ┌────────────────────────────────────────┐      │ │
│  │      │  <PreviewModeBanner />                 │      │ │
│  │      │  • Shows in v0 embedded preview        │      │ │
│  │      │  • Dismissible with session storage    │      │ │
│  │      └────────────────────────────────────────┘      │ │
│  │                                                        │ │
│  │      ┌────────────────────────────────────────┐      │ │
│  │      │  {children}                            │      │ │
│  │      │  • Main application content            │      │ │
│  │      │  • app/page.tsx renders here           │      │ │
│  │      └────────────────────────────────────────┘      │ │
│  │                                                        │ │
│  │      ┌────────────────────────────────────────┐      │ │
│  │      │  <Analytics />                         │      │ │
│  │      └────────────────────────────────────────┘      │ │
│  │    </body>                                            │ │
│  │  </html>                                              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
┌──────────────┐
│   Browser    │
│   Request    │
└──────┬───────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────┐                     ┌─────────────┐
│  app/page.tsx │                     │  API Routes │
│  (Client)    │◄────────────────────│  (Server)   │
└──────┬───────┘                     └─────┬───────┘
       │                                    │
       │ Uses Components:                   │ Uses Libraries:
       │ • preview-mode-banner              │ • lib/leveraged-ai.ts
       │ • data-cards/*                     │ • lib/supabase/*
       │ • ui/*                             │ • lib/model-adapter.ts
       │                                    │
       ▼                                    ▼
┌──────────────────────────────────────────────────┐
│              External Services                    │
│  • Supabase (Database & Auth)                    │
│  • The Odds API                                   │
│  • Grok AI (via AI SDK)                          │
│  • Vercel Analytics                              │
└──────────────────────────────────────────────────┘
```

---

## Type System

```
┌─────────────────────────────────────────────────┐
│           TypeScript Type Sources               │
└─────────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌──────────────┐
│ lib/types.ts│ │types/*.d.ts │ │ node_modules │
│             │ │             │ │   @types/*   │
│ • APIResponse│ │• global.d.ts│ │              │
│ • OddsEvent │ │• ai-sdk-    │ │ • ai         │
│ • InsightCard│ │  extensions │ │ • next       │
│ • TrustMetrics│ │             │ │ • react      │
└─────────────┘ └─────────────┘ └──────────────┘
         │            │            │
         └────────────┼────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Used Throughout App   │
         │  • Components          │
         │  • API Routes          │
         │  • Utilities           │
         └────────────────────────┘
```

---

## Documentation Navigation

```
Need help with an error?
│
├── TypeScript error?
│   └─→ docs/TYPESCRIPT_TROUBLESHOOTING.md
│       ├─ APIResponse types
│       ├─ Supabase client types
│       └─ Optional property safety
│
├── LanguageModel/AI SDK error?
│   └─→ docs/LANGUAGEMODEL_TROUBLESHOOTING.md
│       ├─ Version compatibility
│       ├─ Type extensions
│       └─ Migration guide
│
├── Preview not working?
│   └─→ docs/PREVIEW_MODE_FIX.md
│       ├─ Browser restrictions
│       └─ Fallback implementation
│
├── Token limit error?
│   └─→ docs/MAXOUTPUTTOKENS_ERROR_RESOLUTION.md
│
└── Upgrading AI SDK?
    └─→ docs/AI_SDK_6_UPGRADE.md

Want to understand the project?
│
├── Quick start
│   └─→ README.md
│
├── Complete guide
│   └─→ COMPLETE_DOCUMENTATION.md
│
├── Setup database
│   └─→ SUPABASE_SETUP.md
│
└── Recent changes
    ├─→ REFACTORING_SUMMARY.md (quick)
    └─→ REFACTORING_CHANGELOG.md (detailed)
```

---

## Import Paths

### Components
```typescript
// UI Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Custom Components
import { PreviewModeBanner } from '@/components/preview-mode-banner'
import { DataCard } from '@/components/data-cards/data-card'
```

### Libraries
```typescript
// Supabase
import { createClient } from '@/lib/supabase/client'

// Utilities
import { isInV0Preview } from '@/lib/preview-mode'
import { adaptModel } from '@/lib/model-adapter'

// Types
import type { APIResponse, OddsEvent } from '@/lib/types'
```

### Styles
```typescript
// In app/layout.tsx
import './globals.css'  // ✅ Correct path

// NOT this:
// import '../styles/globals.css'  // ❌ Removed
```

---

## File Naming Conventions

### Components
- **Format:** `kebab-case.tsx`
- **Examples:** 
  - `preview-mode-banner.tsx`
  - `data-card.tsx`
  - `insight-carousel.tsx`

### Libraries
- **Format:** `kebab-case.ts`
- **Examples:**
  - `model-adapter.ts`
  - `preview-mode.ts`
  - `dynamic-config.ts`

### Types
- **Format:** `kebab-case.d.ts`
- **Examples:**
  - `global.d.ts`
  - `ai-sdk-extensions.d.ts`

### Documentation
- **Format:** `SCREAMING_SNAKE_CASE.md`
- **Examples:**
  - `TYPESCRIPT_TROUBLESHOOTING.md`
  - `REFACTORING_CHANGELOG.md`
  - `README.md`

---

## Key Changes from Refactoring

### Before
```
v0-nfc-assistant/
├── TYPESCRIPT_FIXES.md
├── TYPESCRIPT_ERROR_FIXES.md
├── TYPESCRIPT_FIX_SUMMARY.md
├── LANGUAGEMODELV1_ERROR_ANALYSIS.md
├── LANGUAGEMODEL_VERSION_COMPATIBILITY.md
├── LANGUAGEMODEL_FIX_IMPLEMENTATION.md
├── LANGUAGEMODEL_MIGRATION_GUIDE.md
├── LANGUAGEMODEL_QUICK_REFERENCE.md
├── PREVIEW_MODE_FIX.md
├── MAXOUTPUTTOKENS_ERROR_RESOLUTION.md
├── AI_SDK_6_UPGRADE.md
├── app/
│   └── globals.css
└── styles/
    └── globals.css  ← DUPLICATE
```

### After
```
v0-nfc-assistant/
├── docs/
│   ├── TYPESCRIPT_TROUBLESHOOTING.md         ← 3 files merged
│   ├── LANGUAGEMODEL_TROUBLESHOOTING.md      ← 5 files merged
│   ├── PREVIEW_MODE_FIX.md                   ← moved
│   ├── MAXOUTPUTTOKENS_ERROR_RESOLUTION.md   ← moved
│   └── AI_SDK_6_UPGRADE.md                   ← moved
├── components/
│   └── preview-mode-banner.tsx               ← NEW
└── app/
    └── globals.css                           ← only this one
```

---

## Quick Reference

| Task | Location |
|------|----------|
| Start development | `npm run dev` |
| Build for production | `npm run build` |
| Type checking | `npx tsc --noEmit` |
| Find TypeScript docs | `docs/TYPESCRIPT_TROUBLESHOOTING.md` |
| Find AI SDK docs | `docs/LANGUAGEMODEL_TROUBLESHOOTING.md` |
| Main project guide | `COMPLETE_DOCUMENTATION.md` |
| Recent changes | `REFACTORING_SUMMARY.md` |

---

**Last Updated:** February 7, 2026  
**Related:** [docs/README.md](./README.md) • [REFACTORING_CHANGELOG.md](../REFACTORING_CHANGELOG.md)
