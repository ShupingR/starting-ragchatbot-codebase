# Localhost Connection Diagnostics

This comprehensive diagnostic suite identifies why your localhost server connection is failing and provides automated fixes.

## 🚀 Quick Start

```bash
# Basic diagnostics
node frontend/tests/run-diagnostics.js

# Comprehensive diagnostics with fixes
node frontend/tests/run-diagnostics.js --detailed --fix
```

## 📋 What It Tests

### Basic Diagnostics (`diagnostic-runner.js`)
- ✅ Backend server process status  
- ✅ Port binding and conflicts
- ✅ Network connectivity (HTTP connections)
- ✅ API endpoint availability (`/api/courses`, `/api/query`)
- ✅ Environment configuration (`.env` file)
- ✅ Static file serving (frontend assets)

### Detailed Diagnostics (`--detailed` flag)
- 🔧 **Backend Diagnostics** (`backend-diagnostics.js`)
  - Python environment and uv setup
  - Application import testing
  - RAG system initialization
  - Process lifecycle analysis
  - Server startup sequence testing

- 🌐 **Network Diagnostics** (`network-diagnostics.js`)
  - DNS resolution (localhost, 127.0.0.1)
  - Port accessibility testing
  - Firewall configuration
  - Network interface analysis
  - VPN/Proxy interference detection
  - Security software interference

## 🔧 Automated Fixes

The `--fix` flag generates:
- **`automated-fixes.sh`** - Executable bash script with automated fixes
- **`manual-fix-guide.md`** - Step-by-step manual instructions

## 📖 Usage Examples

```bash
# Basic health check
node frontend/tests/run-diagnostics.js

# Full diagnostics with backend and network tests
node frontend/tests/run-diagnostics.js --detailed

# Generate fixes only
node frontend/tests/run-diagnostics.js --fix

# Complete diagnostic and fix generation
node frontend/tests/run-diagnostics.js --detailed --fix

# Show help
node frontend/tests/run-diagnostics.js --help
```

## 🎯 Understanding Results

### Status Icons
- ✅ **PASS** - Component working correctly
- ❌ **FAIL** - Issue detected with specific error details
- ⏳ **PENDING** - Test in progress or skipped

### Output Sections
- **🔧 Recommended fixes** - Actionable solutions for each failure
- **📋 Additional info** - Diagnostic details and context
- **🎯 Final Summary** - Overall results and next steps

## 🚨 Common Issues and Fixes

### Server Not Running
```bash
cd backend
uv sync
uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0
```

### Port Conflicts
```bash
# Check what's using the port
lsof -i :8000

# Kill conflicting processes
sudo lsof -ti:8000 | xargs kill -9
```

### Environment Issues
```bash
# Check .env file
ls -la .env
head .env

# Ensure API key is set
grep ANTHROPIC_API_KEY .env
```

### Python/Dependencies Issues
```bash
cd backend
uv sync
uv run python --version
uv run python -c "import fastapi, uvicorn, anthropic; print('All imports OK')"
```

### Network/Firewall Issues
```bash
# Test direct connection
curl -v http://127.0.0.1:8000

# Check firewall (macOS)
# System Preferences → Security & Privacy → Firewall

# Check localhost resolution
ping -c 1 localhost
```

## 🛠️ Individual Test Modules

### `diagnostic-runner.js` 
Main orchestrator with basic connectivity tests

### `backend-diagnostics.js`
Deep backend process and Python environment testing

### `network-diagnostics.js` 
Network configuration and connectivity issues

### `fix-generator.js`
Automated fix generation based on diagnostic results

### `run-diagnostics.js`
User-friendly command-line interface

## 🐛 Troubleshooting

If diagnostics themselves fail:
1. Ensure Node.js is installed: `node --version`
2. Check file permissions: `ls -la frontend/tests/`
3. Run individual modules: `node frontend/tests/backend-diagnostics.js`
4. Check for missing dependencies: `npm install` (if using npm modules)

## 📝 Contributing

To add new diagnostic tests:
1. Create test function in appropriate module
2. Follow the result format: `{ test, category, status, details, fixes }`
3. Add to the main runner in `run-diagnostics.js`
4. Update this README with new test descriptions

## 🎉 Success Indicators

When all tests pass, you should see:
- ✅ All diagnostic tests passing
- Server accessible at `http://127.0.0.1:8000` or `http://localhost:8000`
- API endpoints responding: `/api/courses`, `/api/query`  
- Frontend loading correctly with course statistics

Your RAG chatbot should now be fully functional! 🚀