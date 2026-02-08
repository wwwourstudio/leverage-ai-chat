/**
 * Model Adapter Utilities
 * Provides type-safe wrappers and utilities for working with different
 * LanguageModel versions in the AI SDK
 */

import type { LanguageModelV1 } from 'ai';

/**
 * Extended Language Model interface that includes all potential properties
 * across different versions
 */
export interface ExtendedLanguageModel extends LanguageModelV1 {
  supportedUrls?: string[];
}

/**
 * Type guard to check if a model supports URL specification
 */
export function isModelWithUrlSupport(
  model: LanguageModelV1
): model is LanguageModelV1 & { supportedUrls: string[] } {
  return 'supportedUrls' in model && Array.isArray((model as any).supportedUrls);
}

/**
 * Adapts a LanguageModelV1 instance to include all properties expected
 * by newer interfaces, providing safe defaults for missing properties
 */
export function adaptModel(model: LanguageModelV1): ExtendedLanguageModel {
  // Check if supportedUrls already exists
  if (isModelWithUrlSupport(model)) {
    return model;
  }

  // Add default empty array for supportedUrls if not present
  return {
    ...model,
    supportedUrls: [],
  };
}

/**
 * Safe getter for supportedUrls property that handles both V1 and V2+ models
 */
export function getSupportedUrls(model: LanguageModelV1): string[] {
  if (isModelWithUrlSupport(model)) {
    return model.supportedUrls;
  }
  return [];
}

/**
 * Validates that a model has all required properties for a given version
 */
export function validateModelVersion(
  model: LanguageModelV1,
  requiredProperties: string[] = []
): boolean {
  console.log('[v0] Validating model properties...');
  console.log('[v0] Model type:', model.constructor?.name || 'Unknown');
  console.log('[v0] Model keys:', Object.keys(model));
  
  const hasAllProperties = requiredProperties.every((prop) => prop in model);
  
  if (!hasAllProperties) {
    const missing = requiredProperties.filter((prop) => !(prop in model));
    console.warn('[v0] Missing model properties:', missing);
  }
  
  return hasAllProperties;
}

/**
 * Creates a type-safe model wrapper that ensures compatibility
 * with all CallSettings and parameter interfaces
 */
export function createCompatibleModel(model: LanguageModelV1): ExtendedLanguageModel {
  const adapted = adaptModel(model);
  
  // Validate the model has basic required properties
  validateModelVersion(adapted, ['specificationVersion', 'provider', 'modelId']);
  
  return adapted;
}

/**
 * Type assertion helper for when you're certain a model is compatible
 * but TypeScript doesn't recognize it
 */
export function assertModelCompatibility<T extends LanguageModelV1>(
  model: LanguageModelV1
): T {
  console.log('[v0] Asserting model compatibility...');
  return model as T;
}

/**
 * Debug utility to inspect model properties at runtime
 */
export function debugModel(model: LanguageModelV1, label: string = 'Model'): void {
  console.group(`[v0] ${label} Debug Info`);
  console.log('Type:', typeof model);
  console.log('Constructor:', model.constructor?.name);
  console.log('Properties:', Object.keys(model));
  console.log('Has supportedUrls:', 'supportedUrls' in model);
  
  if ('supportedUrls' in model) {
    console.log('supportedUrls value:', (model as any).supportedUrls);
  }
  
  // Check for other common properties
  const commonProps = ['specificationVersion', 'provider', 'modelId', 'maxTokens'];
  console.log('Common properties:');
  commonProps.forEach((prop) => {
    if (prop in model) {
      console.log(`  - ${prop}:`, (model as any)[prop]);
    }
  });
  
  console.groupEnd();
}
