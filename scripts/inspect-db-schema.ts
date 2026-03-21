/**
 * Inspect: list all tables in the public schema to find the credits table name.
 */

import pg from 'pg'

const { Client } = pg

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING })

async function main() {
  await client.connect()
  console.log('Connected.\n')

  // List all tables
  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `)
  console.log('Tables in public schema:')
  tables.forEach(r => console.log(' -', r.tablename))

  // Show RLS status of every table
  console.log('\nRLS status:')
  const { rows: rls } = await client.query(`
    SELECT relname, relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY relname
  `)
  rls.forEach(r => console.log(` ${r.relrowsecurity ? '[RLS ON] ' : '[RLS OFF]'} ${r.relname}`))

  // Show existing policies
  console.log('\nExisting policies:')
  const { rows: policies } = await client.query(`
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `)
  policies.forEach(p =>
    console.log(` ${p.tablename} | ${p.cmd} | ${p.roles} | ${p.policyname}`)
  )

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
