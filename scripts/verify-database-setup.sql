-- =============================================================================
-- DATABASE SETUP VERIFICATION SCRIPT
-- Comprehensive checks for database integrity and configuration
-- =============================================================================
-- Run this after setup-database.sql to verify successful setup
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Header
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'LEVERAGEAI DATABASE VERIFICATION';
  RAISE NOTICE 'Running comprehensive integrity checks...';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';

  -- 1. Verify Tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
  
  RAISE NOTICE '1. TABLES: % tables created', table_count;
  
  -- List all tables
  FOR table_name IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    RAISE NOTICE '   - %', table_name;
  END LOOP;
  RAISE NOTICE '';

  -- 2. Verify Views
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public';
  
  RAISE NOTICE '2. VIEWS: % views created', view_count;
  
  FOR view_name IN 
    SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname
  LOOP
    RAISE NOTICE '   - %', view_name;
  END LOOP;
  RAISE NOTICE '';

  -- 3. Verify Functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public';
  
  RAISE NOTICE '3. FUNCTIONS: % functions created', function_count;
  
  FOR func_name IN 
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY proname
  LOOP
    RAISE NOTICE '   - %', func_name;
  END LOOP;
  RAISE NOTICE '';

  -- 4. Verify Triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';
  
  RAISE NOTICE '4. TRIGGERS: % triggers created', trigger_count;
  RAISE NOTICE '';

  -- 5. Verify Indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';
  
  RAISE NOTICE '5. INDEXES: % indexes created', index_count;
  RAISE NOTICE '';

  -- 6. Verify RLS Policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '6. RLS POLICIES: % policies created', policy_count;
  RAISE NOTICE '';

  -- 7. Check RLS Status
  RAISE NOTICE '7. RLS STATUS (Row Level Security enabled):';
  FOR table_name, rls_enabled IN 
    SELECT 
      c.relname,
      c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    IF rls_enabled THEN
      RAISE NOTICE '   - %: ENABLED', table_name;
    ELSE
      RAISE NOTICE '   - %: DISABLED (Warning!)', table_name;
    END IF;
  END LOOP;
  RAISE NOTICE '';

  -- 8. Check for Foreign Key Constraints
  RAISE NOTICE '8. FOREIGN KEY CONSTRAINTS:';
  FOR constraint_info IN 
    SELECT 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  LOOP
    RAISE NOTICE '   - %.% -> %', 
      constraint_info.table_name,
      constraint_info.column_name,
      constraint_info.foreign_table_name;
  END LOOP;
  RAISE NOTICE '';

  -- Final Summary
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Tables: %', table_count;
  RAISE NOTICE '  - Views: %', view_count;
  RAISE NOTICE '  - Functions: %', function_count;
  RAISE NOTICE '  - Triggers: %', trigger_count;
  RAISE NOTICE '  - Indexes: %', index_count;
  RAISE NOTICE '  - RLS Policies: %', policy_count;
  RAISE NOTICE '';
  
  -- Expected values check
  IF table_count >= 16 AND view_count >= 5 AND function_count >= 5 THEN
    RAISE NOTICE 'STATUS: SUCCESS - All database objects created correctly';
  ELSE
    RAISE WARNING 'STATUS: INCOMPLETE - Some objects may be missing';
    RAISE WARNING 'Expected: 16 tables, 5 views, 5+ functions';
    RAISE WARNING 'Got: % tables, % views, % functions', table_count, view_count, function_count;
  END IF;
  
  RAISE NOTICE '========================================================';
END $$;

-- Additional Health Checks
SELECT 'Database Size' as metric, pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 'Current User', current_user
UNION ALL
SELECT 'Current Schema', current_schema()
UNION ALL
SELECT 'PostgreSQL Version', version();
