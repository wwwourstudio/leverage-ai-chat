# Port Conflict Resolution Guide

## Error: EADDRINUSE - Port 3000 Already in Use

This error occurs when Next.js tries to start on port 3000, but another process is already using that port.

---

## Quick Solutions

### Option 1: Kill the Process on Port 3000 (Recommended)

#### Using the Helper Script
```bash
# Make script executable (first time only)
chmod +x scripts/kill-port.sh

# Kill process on port 3000
./scripts/kill-port.sh 3000
```

#### Manual Methods

**On macOS/Linux:**
```bash
# Find the process using port 3000
lsof -ti:3000

# Kill the process (replace PID with the number from above)
kill -9 $(lsof -ti:3000)

# Or in one command
lsof -ti:3000 | xargs kill -9
```

**On Windows (PowerShell):**
```powershell
# Find the process
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Kill the process
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```

**On Windows (Command Prompt):**
```cmd
# Find the process
netstat -ano | findstr :3000

# Kill the process (replace PID with the number from above)
taskkill /PID <PID> /F
```

---

### Option 2: Use a Different Port

#### Temporary (One-Time Use)
```bash
# Run on port 3001 instead
PORT=3001 npm run dev

# Or on Windows
set PORT=3001 && npm run dev
```

#### Permanent Configuration

**Create/Update `.env.local`:**
```bash
# .env.local
PORT=3001
```

**Or modify package.json:**
```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "start": "next start -p 3001"
  }
}
```

---

## Common Causes

1. **Previous Dev Server Still Running**
   - You started `npm run dev` in another terminal
   - The process didn't terminate properly
   - Solution: Kill the process or close all terminals

2. **Another Application Using Port 3000**
   - Common apps: React dev servers, other Next.js projects, Rails apps
   - Solution: Stop the other application or use a different port

3. **Zombie Process**
   - Process crashed but didn't release the port
   - Solution: Kill the process manually

4. **Docker Container**
   - A Docker container is bound to port 3000
   - Solution: `docker ps` to find it, then `docker stop <container-id>`

---

## Debugging Steps

### 1. Identify What's Using the Port

**macOS/Linux:**
```bash
# Show all info about the process
lsof -i:3000

# Just show the process ID
lsof -ti:3000
```

**Windows:**
```powershell
Get-NetTCPConnection -LocalPort 3000 | Select-Object -Property State, OwningProcess
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
```

### 2. Check All Running Node Processes
```bash
# macOS/Linux
ps aux | grep node

# Windows PowerShell
Get-Process node
```

### 3. Verify Port is Free After Killing
```bash
# macOS/Linux - should return nothing
lsof -i:3000

# Windows PowerShell - should return error
Get-NetTCPConnection -LocalPort 3000
```

---

## Best Practices

### Development Environment Setup

1. **Always Clean Start**
   ```bash
   # Kill any existing process first
   ./scripts/kill-port.sh 3000
   
   # Then start dev server
   npm run dev
   ```

2. **Use Terminal Multiplexers**
   - Tools like `tmux` or `screen` help manage terminal sessions
   - Prevents losing track of running servers

3. **Port Management Script**
   Add to `package.json`:
   ```json
   {
     "scripts": {
       "predev": "lsof -ti:3000 | xargs kill -9 2>/dev/null || true",
       "dev": "next dev"
     }
   }
   ```

4. **Use Process Managers**
   - `pm2` or `nodemon` for better process management
   - Automatically restart on crashes
   - Better logging

### Team Development

1. **Document Port Usage**
   - Create a `PORTS.md` file listing all ports used by services
   - Example:
     ```
     - 3000: Next.js dev server
     - 5432: PostgreSQL
     - 6379: Redis
     - 54321: Supabase local
     ```

2. **Use Environment Variables**
   - Never hardcode ports in source code
   - Always use `process.env.PORT` with fallback

3. **Docker Compose**
   - Define ports explicitly in `docker-compose.yml`
   - Use port mapping to avoid conflicts

---

## Vercel Sandbox Environment

**Note:** In Vercel Sandbox, port conflicts are automatically handled. The preview automatically detects open ports and displays your application. You don't need to manually manage ports.

---

## Quick Reference Card

```bash
# KILL PROCESS ON PORT 3000
lsof -ti:3000 | xargs kill -9        # macOS/Linux
taskkill /F /PID <PID>               # Windows

# CHECK PORT STATUS
lsof -i:3000                         # macOS/Linux
netstat -ano | findstr :3000         # Windows

# RUN ON DIFFERENT PORT
PORT=3001 npm run dev                # macOS/Linux
set PORT=3001 && npm run dev         # Windows

# USING HELPER SCRIPT
./scripts/kill-port.sh 3000          # Kill port 3000
./scripts/kill-port.sh 3001          # Kill port 3001
```

---

## Preventive Measures

1. **Exit Properly**: Always use `Ctrl+C` to stop dev servers, don't close terminals forcefully
2. **One Server Per Project**: Don't run multiple dev servers for the same project
3. **Check Before Starting**: Run `lsof -i:3000` before `npm run dev`
4. **Use Unique Ports**: Assign different ports to different projects in `.env.local`
5. **Clean Shutdowns**: Ensure previous processes are fully terminated before starting new ones

---

## Still Having Issues?

If none of the above solutions work:

1. **Restart your terminal** - Sometimes terminal state gets corrupted
2. **Restart your computer** - Nuclear option but effective
3. **Check firewall/security software** - May be blocking port access
4. **Verify Next.js installation** - Run `npm install` to ensure dependencies are correct
5. **Check for system-level port reservations** - Some ports are reserved by the OS

---

## Related Resources

- [Next.js CLI Documentation](https://nextjs.org/docs/api-reference/cli)
- [Node.js Process Management](https://nodejs.org/api/process.html)
- [lsof Command Man Page](https://man7.org/linux/man-pages/man8/lsof.8.html)
