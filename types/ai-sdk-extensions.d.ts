/**
 * AI SDK Type Extensions
 * Extends the AI SDK types to resolve compatibility issues between versions
 */

import 'ai';

declare module 'ai' {
  /**
   * Extend LanguageModelV1 to include properties that may be required
   * by CallSettings or other interfaces expecting newer model versions
   */
  interface LanguageModelV1 {
    /**
     * Optional list of supported URLs for the model.
     * Added for compatibility with newer AI SDK versions that may require this property.
     */
    supportedUrls?: string[];
  }

  /**
   * LanguageModelV2 - Future-proofing for SDK evolution
   * This interface can be used if the AI SDK introduces V2 models
   */
  export interface LanguageModelV2 extends LanguageModelV1 {
    supportedUrls: string[]; // Required in V2
  }

  /**
   * LanguageModelV3 - Placeholder for future versions
   */
  export interface LanguageModelV3 extends LanguageModelV2 {
    // Future properties will be added here
  }

  /**
   * Union type for all model versions
   * Use this when you want to accept any version of the language model
   */
  export type LanguageModel = LanguageModelV1 | LanguageModelV2 | LanguageModelV3;

  /**
   * CallSettings extension to ensure proper typing
   * If CallSettings in your AI SDK expects specific properties, extend it here
   */
  export interface ExtendedCallSettings extends CallSettings {
    model: LanguageModelV1; // Explicitly use V1 to avoid compatibility issues
  }
}

/**
 * Global type helpers for AI SDK usage
 */
declare global {
  /**
   * Type guard to check if a model has URL support
   */
  type ModelWithUrlSupport = import('ai').LanguageModelV1 & {
    supportedUrls: string[];
  };

  /**
   * Utility type to extract model properties
   */
  type ModelProperties<T> = T extends import('ai').LanguageModelV1 ? keyof T : never;
}

export {};
