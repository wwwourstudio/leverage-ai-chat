import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getConfigs, getWelcomeMessages, clearConfigCache } from '@/lib/dynamic-config';
import { LOG_PREFIXES, HTTP_STATUS } from '@/lib/constants';

export const runtime = 'edge';

/**
 * GET /api/config
 * Fetch configuration values dynamically
 * 
 * Query parameters:
 * - key: specific config key to fetch
 * - category: filter by category
 * - type: 'single' | 'multiple' | 'welcome_messages'
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const category = searchParams.get('category') || 'general';
    const type = searchParams.get('type') || 'single';

    console.log(`${LOG_PREFIXES.CONFIG} Fetching config:`, { key, category, type });

    // Fetch welcome messages
    if (type === 'welcome_messages') {
      const messages = await getWelcomeMessages();
      return NextResponse.json({
        success: true,
        data: messages,
        source: 'database',
        timestamp: new Date().toISOString()
      });
    }

    // Fetch single config
    if (type === 'single' && key) {
      const value = await getConfig(key, null, category);
      return NextResponse.json({
        success: true,
        key,
        value,
        category,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch multiple configs
    if (type === 'multiple') {
      const keys = searchParams.get('keys')?.split(',') || [];
      
      if (keys.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No keys provided for multiple config fetch'
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }

      const configKeys = keys.map(k => ({
        key: k,
        defaultValue: null,
        category: category
      }));

      const configs = await getConfigs(configKeys);
      
      return NextResponse.json({
        success: true,
        data: configs,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request. Specify key for single config or type=welcome_messages'
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.CONFIG} Error in config route:`, errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * POST /api/config
 * Clear configuration cache (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (body.action === 'clear_cache') {
      clearConfigCache();
      console.log(`${LOG_PREFIXES.CONFIG} Cache cleared via API`);
      
      return NextResponse.json({
        success: true,
        message: 'Configuration cache cleared',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use action: "clear_cache"'
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${LOG_PREFIXES.CONFIG} Error in config POST:`, errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}
