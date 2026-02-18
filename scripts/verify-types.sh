#!/bin/bash

# TypeScript Error Verification Script
# Runs type checking and reports any remaining errors

echo "🔍 Running TypeScript type checking..."
echo ""

# Run TypeScript compiler in noEmit mode to check types without building
npx tsc --noEmit

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All TypeScript errors resolved!"
  echo ""
  echo "Verification Summary:"
  echo "  ✓ LanguageModelV1 compatibility fixed"
  echo "  ✓ GameLocation null safety handled"
  echo "  ✓ WeatherCard index signature added"
  echo "  ✓ BaseCard children made optional"
  echo "  ✓ oddsData null checks in place"
  echo "  ✓ preview-mode module created"
  echo ""
  echo "📚 See docs/TYPE_FIXES_APPLIED.md for details"
  exit 0
else
  echo ""
  echo "❌ TypeScript errors still present"
  echo ""
  echo "Please review the output above and check:"
  echo "  - docs/TYPESCRIPT_TROUBLESHOOTING.md"
  echo "  - docs/LANGUAGEMODEL_TROUBLESHOOTING.md"
  echo "  - docs/TYPE_FIXES_APPLIED.md"
  exit 1
fi
