# Troubleshooting Guide

Common issues and their solutions for the NFC Assistant application.

## JSON Parsing Errors

### Error: "Unexpected token 'I', 'Invalid re'... is not valid JSON"

**Cause**: API response contains non-JSON content (usually an error message).

**Solution**:
1. Check that all environment variables are properly set (see ENV_CONFIGURATION.md)
2. Verify API responses are returning valid JSON
3. Check server logs for the actual error message
4. Ensure database tables exist if using Supabase

**Fixed in latest version**: Enhanced error handling now safely handles non-JSON responses.

---

## API Errors

### Error: "The model grok-beta was deprecated"

**Cause**: Using deprecated Grok model.

**Solution**: 
- ✅ **Fixed**: Now using `grok-3` model
- Update any custom code referencing `grok-beta` to `grok-3`

### Error: "Invalid API key" or "401 Unauthorized"

**Cause**: Missing or incorrect API key.

**Solution**:
1. Check environment variables are set correctly
2. Verify API keys haven't expired
3. Test API key directly:
   ```bash
   # Test Grok API
   curl https://api.x.ai/v1/models \
     -H "Authorization: Bearer $XAI_API_KEY"
   
   # Test Odds API
   curl "https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY"
   ```

### Error: "AI service not configured" or "useFallback: true"

**Cause**: Missing XAI_API_KEY environment variable.

**Solution**:
1. Get API key from https://console.x.ai/
2. Add to environment variables:
   ```bash
   XAI_API_KEY=your-api-key-here
   ```
3. Restart your development server

---

## Database Errors

### Error: "table 'ai_predictions' does not exist"

**Cause**: Supabase database tables not created.

**Solution**:
1. Run migrations:
   ```bash
   npx supabase db push
   ```
2. Or manually create tables using Supabase dashboard
3. Check `supabase/migrations/` for schema definitions

### Error: "Could not fetch historical accuracy"

**Cause**: Database query failed (table doesn't exist or no data).

**Solution**:
- This is non-critical and falls back to defaults
- Run migrations to create tables
- Error is logged but doesn't affect functionality

### Error: "Supabase query error (table may not exist yet)"

**Cause**: Attempting to query table that hasn't been created.

**Solution**:
- ✅ **Handled gracefully**: Returns default data
- To fix: Run Supabase migrations
- Check health endpoint: `/api/health`

---

## Configuration Issues

### How to check current configuration

```bash
# Check health endpoint
curl http://localhost:3000/api/health | jq

# Check specific service
curl http://localhost:3000/api/health | jq '.integrations.grokAI'
```

### Missing environment variables

**Symptoms**:
- "Service not configured" errors
- Fallback responses instead of real data
- Health check showing missing services

**Solution**:
1. Create `.env.local` file (local development)
2. Add required variables (see ENV_CONFIGURATION.md)
3. Restart development server: `npm run dev`

For production (Vercel):
1. Go to project settings
2. Navigate to Environment Variables
3. Add all required variables
4. Redeploy application

### Variables not loading

**Common mistakes**:
- ❌ Using `.env` instead of `.env.local`
- ❌ Not restarting dev server after changes
- ❌ Extra spaces in variable values
- ❌ Missing quotes for values with special characters

**Solution**:
```bash
# .env.local (correct format)
XAI_API_KEY=xai-abc123xyz
ODDS_API_KEY=abc123xyz456
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Rate Limiting

### Error: "API rate limit exceeded"

**Cause**: Too many API requests.

**Solution**:
1. **Odds API**: Free tier = 500 requests/month
   - Check usage: Response headers include `x-requests-remaining`
   - Upgrade plan or reduce request frequency
   - Use caching (already implemented with 1-minute cache)

2. **Grok API**: Check xAI dashboard for limits
   - Monitor token usage
   - Implement request throttling if needed

---

## Development Issues

### Hot reload not working after env changes

**Solution**:
```bash
# Stop server (Ctrl+C)
# Clear Next.js cache
rm -rf .next

# Restart
npm run dev
```

### TypeScript errors after updates

**Solution**:
```bash
# Regenerate types
npm run build

# Or check types without building
npx tsc --noEmit
```

### Module not found errors

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## Production Issues

### Works locally but fails in production

**Common causes**:
1. Environment variables not set in Vercel
2. Different variable values between environments
3. Build-time vs runtime variable access

**Solution**:
1. Check Vercel dashboard → Settings → Environment Variables
2. Ensure all variables are set for Production scope
3. Redeploy after adding variables
4. Check deployment logs for specific errors

### Database connection fails in production

**Solution**:
1. Verify Supabase project is not paused
2. Check connection string is correct
3. Verify database is in same region as deployment
4. Check Supabase dashboard for connection issues

---

## Testing & Debugging

### Enable detailed logging

Add to your code temporarily:
```typescript
console.log('[v0] Debug point:', variableName);
```

Check logs:
- **Local**: Terminal where dev server runs
- **Vercel**: Dashboard → Deployments → Function logs

### Test individual endpoints

```bash
# Test analysis
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Test analysis"}' | jq

# Test odds
curl -X POST http://localhost:3000/api/odds \
  -H "Content-Type: application/json" \
  -d '{"sport": "americanfootball_nfl"}' | jq

# Test insights
curl http://localhost:3000/api/insights | jq

# Test health
curl http://localhost:3000/api/health | jq
```

### Check browser console

Open Developer Tools (F12) and check:
1. Console tab for JavaScript errors
2. Network tab for failed API requests
3. Response bodies for error details

---

## Getting Help

### Before asking for help

1. **Check health endpoint**: Verify configuration status
2. **Check logs**: Both browser console and server logs
3. **Test APIs**: Use curl commands to isolate issues
4. **Verify environment**: Ensure all required variables are set

### Diagnostic information to provide

```bash
# Get diagnostic info
curl http://localhost:3000/api/health | jq > health-status.json

# Check Node version
node --version

# Check npm version
npm --version

# Check Next.js version
npm list next
```

### Useful resources

- **Environment Setup**: [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)
- **Recent Fixes**: [FIXES_APPLIED.md](./FIXES_APPLIED.md)
- **Integration Guides**: [INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md)
- **Supabase Docs**: https://supabase.com/docs
- **xAI Docs**: https://docs.x.ai/
- **The Odds API Docs**: https://the-odds-api.com/liveapi/guides/v4/

---

## Common Error Messages Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Unexpected token 'I'` | Non-JSON response parsed as JSON | ✅ Fixed in latest version |
| `grok-beta was deprecated` | Using old model | ✅ Fixed - now using grok-3 |
| `Invalid API key` | Wrong or missing API key | Check environment variables |
| `Table does not exist` | Missing database tables | Run Supabase migrations |
| `AI service not configured` | Missing XAI_API_KEY | Add to environment variables |
| `ODDS_API_KEY not configured` | Missing ODDS_API_KEY | Add to environment variables |
| `Rate limit exceeded` | Too many API requests | Upgrade plan or use caching |
| `CORS error` | Cross-origin request blocked | Use API routes, not direct calls |
| `Module not found` | Missing dependency | Run `npm install` |
| `Build failed` | TypeScript/build errors | Check build logs for details |

---

## Still Having Issues?

If you're still experiencing problems after trying these solutions:

1. **Check documentation**: Review all MD files in the repository
2. **Verify configuration**: Use `/api/health` endpoint
3. **Clear caches**: Delete `.next`, `node_modules`, restart
4. **Test in isolation**: Use curl to test individual endpoints
5. **Check service status**: Verify third-party services (Supabase, xAI, Odds API) are operational
