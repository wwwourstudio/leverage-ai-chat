-- Check what schemas exist and what tables are in each
SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'api', 'graphql_public') ORDER BY schemaname, tablename;
