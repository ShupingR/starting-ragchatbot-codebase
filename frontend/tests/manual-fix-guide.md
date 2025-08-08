# 🔧 Manual Fix Guide

This guide provides step-by-step instructions to fix detected issues.

## 🚨 High Priority Issues (Fix First)

### 1. Fix Backend Server Process

**Problem:** Backend server process is not running or has issues

**Steps:**
1. Navigate to backend directory: cd backend
2. Ensure uv environment is set up: uv sync
3. Start server: uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0
4. If port 8000 is busy, try: uv run uvicorn app:app --reload --port 8080 --host 0.0.0.0

**Commands:**
```bash
cd backend
uv sync
uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0
```

**Verification:**
```bash
Check if process appears in: ps aux | grep uvicorn
```

---

### 2. Fix Environment Configuration

**Problem:** Environment variables or configuration files are incorrect

**Steps:**
1. Check .env file exists: ls -la .env
2. Verify ANTHROPIC_API_KEY is set: grep ANTHROPIC_API_KEY .env
3. Create .env if missing: cp .env.example .env
4. Add your API key to .env file

**Commands:**
```bash
ls -la .env
head -5 .env
```

**Verification:**
```bash
cd backend && uv run python -c "import os; print('API key present:', bool(os.getenv('ANTHROPIC_API_KEY')))"
```

---

### 3. Fix Python Environment

**Problem:** Python environment or dependencies are not properly set up

**Steps:**
1. Install uv if missing: curl -LsSf https://astral.sh/uv/install.sh | sh
2. Navigate to backend: cd backend
3. Sync dependencies: uv sync
4. Test Python access: uv run python --version

**Commands:**
```bash
cd backend
uv sync
uv run python --version
```

**Verification:**
```bash
uv run python -c "import fastapi, uvicorn, anthropic; print('All imports successful')"
```

---

### 4. Fix Application Import Issues

**Problem:** Application code has import or initialization errors

**Steps:**
1. Check syntax errors: cd backend && uv run python -m py_compile app.py
2. Install missing dependencies: uv add fastapi uvicorn anthropic chromadb
3. Verify config file exists: ls -la config.py
4. Test imports: uv run python -c "import app; print('App imports OK')"

**Commands:**
```bash
cd backend
uv run python -m py_compile app.py
uv add fastapi uvicorn anthropic chromadb sentence-transformers
uv run python -c "import app; print('App imports OK')"
```

**Verification:**
```bash
uv run python -c "import app; print(type(app.app))"
```

---

## ⚠️ Medium Priority Issues

### 1. Fix Port Binding Issues

**Problem:** Port conflicts or binding problems preventing server access

**Steps:**
1. Check what's using your ports: lsof -i :8000 && lsof -i :8080
2. Kill conflicting processes: sudo lsof -ti:8000 | xargs kill -9
3. Try different port: uv run uvicorn app:app --port 3000
4. Bind to all interfaces: uv run uvicorn app:app --host 0.0.0.0 --port 8000

**Commands:**
```bash
lsof -i :8000
lsof -i :8080
sudo lsof -ti:8000 | xargs kill -9 2>/dev/null || true
```

**Verification:**
```bash
netstat -an | grep LISTEN | grep 8000
```

---

### 2. Fix API Endpoint Issues

**Problem:** API endpoints not responding correctly

**Steps:**
1. Ensure server is running on correct port
2. Test API endpoints directly: curl http://127.0.0.1:8000/api/courses
3. Check server logs for errors
4. Verify FastAPI app is properly configured

**Commands:**
```bash
curl -v http://127.0.0.1:8000/api/courses
curl -v http://127.0.0.1:8000/docs
```

**Verification:**
```bash
curl -s http://127.0.0.1:8000/api/courses | head -20
```

---

## ℹ️ Low Priority Issues

### 1. Fix Frontend File Serving

**Problem:** Frontend static files not being served correctly

**Steps:**
1. Verify frontend files exist: ls -la frontend/
2. Check FastAPI static file mounting in app.py
3. Clear browser cache: Cmd+Shift+R (or Ctrl+Shift+R)
4. Test static file directly: curl http://127.0.0.1:8000/

**Commands:**
```bash
ls -la frontend/
curl -v http://127.0.0.1:8000/
```

**Verification:**
```bash
curl -s http://127.0.0.1:8000/ | grep -q "Course Materials"
```

---

## 🧪 Final Verification

After applying fixes, verify your setup:
```bash
# Run the diagnostic again
node frontend/tests/diagnostic-runner.js

# Or test manually
curl http://127.0.0.1:8000
```