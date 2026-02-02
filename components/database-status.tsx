'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface TableStatus {
  name: string
  exists: boolean
  rowCount?: number
}

export function DatabaseStatus() {
  const [status, setStatus] = useState<{
    loading: boolean
    tables: TableStatus[]
    error?: string
  }>({
    loading: true,
    tables: [],
  })

  useEffect(() => {
    async function checkTables() {
      const supabase = createClient()

      const requiredTables = [
        'users',
        'chats',
        'messages',
        'credits_ledger',
        'odds_cache',
        'user_portfolios',
        'portfolio_updates',
        'ai_response_trust',
        'ai_audit_log',
      ]

      const tableStatuses: TableStatus[] = []

      for (const tableName of requiredTables) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          if (error) {
            // Table might not exist
            tableStatuses.push({ name: tableName, exists: false })
          } else {
            tableStatuses.push({
              name: tableName,
              exists: true,
              rowCount: count ?? 0,
            })
          }
        } catch (err) {
          tableStatuses.push({ name: tableName, exists: false })
        }
      }

      setStatus({ loading: false, tables: tableStatuses })
    }

    checkTables()
  }, [])

  if (status.loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Checking database status...
          </p>
        </div>
      </Card>
    )
  }

  const allTablesExist = status.tables.every((t) => t.exists)
  const missingTables = status.tables.filter((t) => !t.exists)

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {allTablesExist ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-semibold">Database Ready</h3>
                <p className="text-sm text-muted-foreground">
                  All migrations have been applied successfully
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-6 w-6 text-amber-600" />
              <div>
                <h3 className="font-semibold">Migrations Needed</h3>
                <p className="text-sm text-muted-foreground">
                  {missingTables.length} table(s) need to be created
                </p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          {status.tables.map((table) => (
            <div
              key={table.name}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                {table.exists ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <code className="text-sm font-mono">{table.name}</code>
              </div>
              {table.exists && (
                <span className="text-sm text-muted-foreground">
                  {table.rowCount} rows
                </span>
              )}
            </div>
          ))}
        </div>

        {!allTablesExist && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-900">
            <p className="text-sm text-amber-900 dark:text-amber-200 font-medium mb-2">
              Run migrations manually:
            </p>
            <ol className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-decimal list-inside">
              <li>Open Supabase Dashboard → SQL Editor</li>
              <li>Copy migration files from /supabase/migrations/</li>
              <li>Execute them in numerical order</li>
              <li>Refresh this page to verify</li>
            </ol>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
              See <code className="font-mono">/QUICK_START.md</code> for
              detailed instructions
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
