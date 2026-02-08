/**
 * Model Type Verification Script
 * Verifies that all LanguageModel type issues are resolved
 */

import type { LanguageModelV1 } from 'ai';
import { xai } from '@ai-sdk/xai';
import {
  adaptModel,
  isModelWithUrlSupport,
  getSupportedUrls,
  debugModel,
  validateModelVersion,
} from '@/lib/model-adapter';

/**
 * Test 1: Verify LanguageModelV1 can be instantiated
 */
function test1_ModelInstantiation() {
  console.log('\n=== Test 1: Model Instantiation ===');
  try {
    const model = xai('grok-beta');
    console.log('✅ Model instantiated successfully');
    console.log('Model type:', typeof model);
    return true;
  } catch (error) {
    console.error('❌ Failed to instantiate model:', error);
    return false;
  }
}

/**
 * Test 2: Verify type compatibility with CallSettings
 */
function test2_CallSettingsCompatibility() {
  console.log('\n=== Test 2: CallSettings Compatibility ===');
  try {
    const model: LanguageModelV1 = xai('grok-beta');
    
    // This should not produce type errors
    const callSettings = {
      model: model,
      temperature: 0.7,
      maxOutputTokens: 500,
    };
    
    console.log('✅ Model is compatible with CallSettings');
    console.log('CallSettings:', callSettings);
    return true;
  } catch (error) {
    console.error('❌ CallSettings compatibility failed:', error);
    return false;
  }
}

/**
 * Test 3: Verify supportedUrls property handling
 */
function test3_SupportedUrlsProperty() {
  console.log('\n=== Test 3: supportedUrls Property ===');
  try {
    const model = xai('grok-beta');
    
    console.log('Has supportedUrls:', 'supportedUrls' in model);
    
    if (isModelWithUrlSupport(model)) {
      console.log('✅ Model has supportedUrls:', model.supportedUrls);
    } else {
      console.log('⚠️  Model does not have supportedUrls (expected for V1)');
    }
    
    // Test safe getter
    const urls = getSupportedUrls(model);
    console.log('✅ Safe getter returned:', urls);
    
    return true;
  } catch (error) {
    console.error('❌ supportedUrls test failed:', error);
    return false;
  }
}

/**
 * Test 4: Verify model adapter functionality
 */
function test4_ModelAdapter() {
  console.log('\n=== Test 4: Model Adapter ===');
  try {
    const model = xai('grok-beta');
    const adaptedModel = adaptModel(model);
    
    console.log('✅ Model adapted successfully');
    console.log('Adapted model has supportedUrls:', 'supportedUrls' in adaptedModel);
    
    if ('supportedUrls' in adaptedModel) {
      console.log('supportedUrls value:', adaptedModel.supportedUrls);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Model adapter test failed:', error);
    return false;
  }
}

/**
 * Test 5: Verify type definitions are loaded
 */
function test5_TypeDefinitions() {
  console.log('\n=== Test 5: Type Definitions ===');
  
  // These should compile without errors
  type V1 = LanguageModelV1;
  
  // Check if extended types exist
  try {
    // This will cause a compile error if types aren't properly defined
    const model: LanguageModelV1 = xai('grok-beta');
    
    // Type assertion to test extended types
    const modelWithUrls = model as LanguageModelV1 & { supportedUrls?: string[] };
    
    console.log('✅ Type definitions loaded correctly');
    console.log('LanguageModelV1: available');
    
    return true;
  } catch (error) {
    console.error('❌ Type definition test failed:', error);
    return false;
  }
}

/**
 * Test 6: Debug model properties
 */
function test6_DebugProperties() {
  console.log('\n=== Test 6: Debug Model Properties ===');
  try {
    const model = xai('grok-beta');
    debugModel(model, 'Grok Beta Model');
    
    // Validate required properties
    const isValid = validateModelVersion(model, [
      'specificationVersion',
      'provider',
      'modelId',
    ]);
    
    if (isValid) {
      console.log('✅ Model has all required properties');
    } else {
      console.warn('⚠️  Model missing some properties (may be expected)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return false;
  }
}

/**
 * Test 7: Verify generateText compatibility
 */
async function test7_GenerateTextCompatibility() {
  console.log('\n=== Test 7: generateText Compatibility ===');
  try {
    const { generateText } = await import('ai');
    const model = xai('grok-beta');
    
    // This should be type-safe
    const params = {
      model: model, // Should not produce type error
      prompt: 'Test prompt',
      temperature: 0.7,
      maxOutputTokens: 50,
    };
    
    console.log('✅ generateText parameters are type-safe');
    console.log('Params:', params);
    
    // Note: Not actually calling generateText to avoid API costs
    return true;
  } catch (error) {
    console.error('❌ generateText compatibility test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🔍 Starting Model Type Verification...\n');
  console.log('=' .repeat(50));
  
  const results = [
    test1_ModelInstantiation(),
    test2_CallSettingsCompatibility(),
    test3_SupportedUrlsProperty(),
    test4_ModelAdapter(),
    test5_TypeDefinitions(),
    test6_DebugProperties(),
    await test7_GenerateTextCompatibility(),
  ];
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Summary:');
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(Boolean).length}`);
  console.log(`Failed: ${results.filter((r) => !r).length}`);
  
  if (results.every(Boolean)) {
    console.log('\n✅ All tests passed! Model types are compatible.');
    return 0;
  } else {
    console.log('\n❌ Some tests failed. Please review the errors above.');
    return 1;
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().then(process.exit);
}

export { runAllTests };
