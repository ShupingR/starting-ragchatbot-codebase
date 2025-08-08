/**
 * Fix Generator Module
 * 
 * Generates automated fixes and provides step-by-step solutions
 * for common localhost connection issues.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class FixGenerator {
    constructor(config = {}) {
        this.backendPath = config.backendPath || '../backend';
        this.fixes = [];
    }

    // Generate fixes based on diagnostic results
    generateFixes(diagnosticResults) {
        const fixes = [];
        
        diagnosticResults.forEach(result => {
            if (result.status === 'fail') {
                const fix = this.createFix(result);
                if (fix) {
                    fixes.push(fix);
                }
            }
        });

        return fixes;
    }

    createFix(diagnosticResult) {
        const category = diagnosticResult.category || 'general';
        const testName = diagnosticResult.testName || diagnosticResult.test;
        
        switch (category) {
            case 'backend':
            case 'infrastructure':
                return this.createBackendFix(testName, diagnosticResult);
            case 'network':
                return this.createNetworkFix(testName, diagnosticResult);
            case 'api':
                return this.createAPIFix(testName, diagnosticResult);
            case 'configuration':
                return this.createConfigFix(testName, diagnosticResult);
            case 'frontend':
                return this.createFrontendFix(testName, diagnosticResult);
            default:
                return this.createGenericFix(testName, diagnosticResult);
        }
    }

    createBackendFix(testName, result) {
        if (testName.includes('Process') || testName.includes('Backend Process')) {
            return {
                title: 'Fix Backend Server Process',
                priority: 'high',
                category: 'backend',
                description: 'Backend server process is not running or has issues',
                steps: [
                    'Navigate to backend directory: cd backend',
                    'Ensure uv environment is set up: uv sync',
                    'Start server: uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0',
                    'If port 8000 is busy, try: uv run uvicorn app:app --reload --port 8080 --host 0.0.0.0'
                ],
                commands: [
                    'cd backend',
                    'uv sync',
                    'uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0'
                ],
                verification: 'Check if process appears in: ps aux | grep uvicorn'
            };
        }

        if (testName.includes('Python Environment')) {
            return {
                title: 'Fix Python Environment',
                priority: 'high',
                category: 'backend',
                description: 'Python environment or dependencies are not properly set up',
                steps: [
                    'Install uv if missing: curl -LsSf https://astral.sh/uv/install.sh | sh',
                    'Navigate to backend: cd backend', 
                    'Sync dependencies: uv sync',
                    'Test Python access: uv run python --version'
                ],
                commands: [
                    'cd backend',
                    'uv sync',
                    'uv run python --version'
                ],
                verification: 'uv run python -c "import fastapi, uvicorn, anthropic; print(\'All imports successful\')"'
            };
        }

        if (testName.includes('Import') || testName.includes('Application')) {
            return {
                title: 'Fix Application Import Issues',
                priority: 'high',
                category: 'backend',
                description: 'Application code has import or initialization errors',
                steps: [
                    'Check syntax errors: cd backend && uv run python -m py_compile app.py',
                    'Install missing dependencies: uv add fastapi uvicorn anthropic chromadb',
                    'Verify config file exists: ls -la config.py',
                    'Test imports: uv run python -c "import app; print(\'App imports OK\')"'
                ],
                commands: [
                    'cd backend',
                    'uv run python -m py_compile app.py',
                    'uv add fastapi uvicorn anthropic chromadb sentence-transformers',
                    'uv run python -c "import app; print(\'App imports OK\')"'
                ],
                verification: 'uv run python -c "import app; print(type(app.app))"'
            };
        }

        return null;
    }

    createNetworkFix(testName, result) {
        if (testName.includes('Port') || testName.includes('Binding')) {
            return {
                title: 'Fix Port Binding Issues',
                priority: 'medium',
                category: 'network',
                description: 'Port conflicts or binding problems preventing server access',
                steps: [
                    'Check what\'s using your ports: lsof -i :8000 && lsof -i :8080',
                    'Kill conflicting processes: sudo lsof -ti:8000 | xargs kill -9',
                    'Try different port: uv run uvicorn app:app --port 3000',
                    'Bind to all interfaces: uv run uvicorn app:app --host 0.0.0.0 --port 8000'
                ],
                commands: [
                    'lsof -i :8000',
                    'lsof -i :8080',
                    'sudo lsof -ti:8000 | xargs kill -9 2>/dev/null || true'
                ],
                verification: 'netstat -an | grep LISTEN | grep 8000'
            };
        }

        if (testName.includes('DNS') || testName.includes('Resolution')) {
            return {
                title: 'Fix DNS/Localhost Resolution',
                priority: 'low',
                category: 'network', 
                description: 'Localhost or 127.0.0.1 not resolving properly',
                steps: [
                    'Check /etc/hosts file: cat /etc/hosts | grep localhost',
                    'Add localhost entry if missing: echo "127.0.0.1 localhost" | sudo tee -a /etc/hosts',
                    'Flush DNS cache (macOS): sudo dscacheutil -flushcache',
                    'Test resolution: ping -c 1 localhost'
                ],
                commands: [
                    'cat /etc/hosts | grep -E "(127.0.0.1|localhost)"',
                    'ping -c 1 localhost'
                ],
                verification: 'nslookup localhost'
            };
        }

        if (testName.includes('Firewall')) {
            return {
                title: 'Fix Firewall Blocking',
                priority: 'medium',
                category: 'network',
                description: 'System firewall blocking localhost connections',
                steps: [
                    'macOS: System Preferences → Security & Privacy → Firewall → Options',
                    'Allow incoming connections for Python/uvicorn',
                    'Or temporarily disable firewall for testing',
                    'Linux: sudo ufw allow 8000 (if using UFW)',
                    'Test with curl: curl -v http://127.0.0.1:8000'
                ],
                commands: [
                    'curl -v --connect-timeout 5 http://127.0.0.1:8000'
                ],
                verification: 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000'
            };
        }

        return null;
    }

    createAPIFix(testName, result) {
        return {
            title: 'Fix API Endpoint Issues',
            priority: 'medium',
            category: 'api',
            description: 'API endpoints not responding correctly',
            steps: [
                'Ensure server is running on correct port',
                'Test API endpoints directly: curl http://127.0.0.1:8000/api/courses',
                'Check server logs for errors',
                'Verify FastAPI app is properly configured'
            ],
            commands: [
                'curl -v http://127.0.0.1:8000/api/courses',
                'curl -v http://127.0.0.1:8000/docs'
            ],
            verification: 'curl -s http://127.0.0.1:8000/api/courses | head -20'
        };
    }

    createConfigFix(testName, result) {
        if (testName.includes('Environment')) {
            return {
                title: 'Fix Environment Configuration',
                priority: 'high',
                category: 'configuration',
                description: 'Environment variables or configuration files are incorrect',
                steps: [
                    'Check .env file exists: ls -la .env',
                    'Verify ANTHROPIC_API_KEY is set: grep ANTHROPIC_API_KEY .env',
                    'Create .env if missing: cp .env.example .env',
                    'Add your API key to .env file'
                ],
                commands: [
                    'ls -la .env',
                    'head -5 .env'
                ],
                verification: 'cd backend && uv run python -c "import os; print(\'API key present:\', bool(os.getenv(\'ANTHROPIC_API_KEY\')))"'
            };
        }

        return null;
    }

    createFrontendFix(testName, result) {
        return {
            title: 'Fix Frontend File Serving',
            priority: 'low',
            category: 'frontend',
            description: 'Frontend static files not being served correctly',
            steps: [
                'Verify frontend files exist: ls -la frontend/',
                'Check FastAPI static file mounting in app.py',
                'Clear browser cache: Cmd+Shift+R (or Ctrl+Shift+R)',
                'Test static file directly: curl http://127.0.0.1:8000/'
            ],
            commands: [
                'ls -la frontend/',
                'curl -v http://127.0.0.1:8000/'
            ],
            verification: 'curl -s http://127.0.0.1:8000/ | grep -q "Course Materials"'
        };
    }

    createGenericFix(testName, result) {
        return {
            title: `Fix ${testName}`,
            priority: 'medium',
            category: 'general',
            description: result.message || 'General system issue detected',
            steps: result.fixes || [
                'Review diagnostic details',
                'Check system logs',
                'Restart services if necessary'
            ],
            commands: [],
            verification: 'Rerun diagnostics to verify fix'
        };
    }

    // Generate an automated fix script
    async generateFixScript(fixes) {
        const scriptLines = [
            '#!/bin/bash',
            '#',
            '# Automated Fix Script',
            '# Generated by Localhost Connection Diagnostics',
            '#',
            '',
            'echo "🔧 Starting automated fixes..."',
            ''
        ];

        fixes.forEach((fix, index) => {
            scriptLines.push(`echo "Step ${index + 1}: ${fix.title}"`);
            scriptLines.push(`echo "Description: ${fix.description}"`);
            scriptLines.push('');
            
            fix.commands.forEach(cmd => {
                scriptLines.push(`echo "Running: ${cmd}"`);
                scriptLines.push(`${cmd}`);
                scriptLines.push('if [ $? -ne 0 ]; then');
                scriptLines.push(`  echo "⚠️  Command failed: ${cmd}"`);
                scriptLines.push('else');
                scriptLines.push(`  echo "✅ Command succeeded: ${cmd}"`);
                scriptLines.push('fi');
                scriptLines.push('');
            });
            
            if (fix.verification) {
                scriptLines.push('echo "Verifying fix..."');
                scriptLines.push(`if ${fix.verification}; then`);
                scriptLines.push(`  echo "✅ ${fix.title} - VERIFIED"`);
                scriptLines.push('else');
                scriptLines.push(`  echo "❌ ${fix.title} - VERIFICATION FAILED"`);
                scriptLines.push('fi');
                scriptLines.push('');
            }
            
            scriptLines.push('echo "---"');
            scriptLines.push('');
        });

        scriptLines.push('echo "🎉 Automated fixes completed!"');
        scriptLines.push('echo "Please run the diagnostics again to verify all issues are resolved."');

        return scriptLines.join('\n');
    }

    // Create a manual fix guide
    generateManualGuide(fixes) {
        const guide = [];
        
        guide.push('# 🔧 Manual Fix Guide');
        guide.push('');
        guide.push('This guide provides step-by-step instructions to fix detected issues.');
        guide.push('');

        // Group fixes by priority
        const highPriority = fixes.filter(f => f.priority === 'high');
        const mediumPriority = fixes.filter(f => f.priority === 'medium');
        const lowPriority = fixes.filter(f => f.priority === 'low');

        if (highPriority.length > 0) {
            guide.push('## 🚨 High Priority Issues (Fix First)');
            guide.push('');
            highPriority.forEach((fix, index) => {
                this.addFixToGuide(guide, fix, index + 1);
            });
        }

        if (mediumPriority.length > 0) {
            guide.push('## ⚠️ Medium Priority Issues');
            guide.push('');
            mediumPriority.forEach((fix, index) => {
                this.addFixToGuide(guide, fix, index + 1);
            });
        }

        if (lowPriority.length > 0) {
            guide.push('## ℹ️ Low Priority Issues');
            guide.push('');
            lowPriority.forEach((fix, index) => {
                this.addFixToGuide(guide, fix, index + 1);
            });
        }

        guide.push('## 🧪 Final Verification');
        guide.push('');
        guide.push('After applying fixes, verify your setup:');
        guide.push('```bash');
        guide.push('# Run the diagnostic again');
        guide.push('node frontend/tests/diagnostic-runner.js');
        guide.push('');
        guide.push('# Or test manually');
        guide.push('curl http://127.0.0.1:8000');
        guide.push('```');

        return guide.join('\n');
    }

    addFixToGuide(guide, fix, index) {
        guide.push(`### ${index}. ${fix.title}`);
        guide.push('');
        guide.push(`**Problem:** ${fix.description}`);
        guide.push('');
        guide.push('**Steps:**');
        fix.steps.forEach((step, stepIndex) => {
            guide.push(`${stepIndex + 1}. ${step}`);
        });
        guide.push('');
        
        if (fix.commands.length > 0) {
            guide.push('**Commands:**');
            guide.push('```bash');
            fix.commands.forEach(cmd => {
                guide.push(cmd);
            });
            guide.push('```');
            guide.push('');
        }
        
        if (fix.verification) {
            guide.push('**Verification:**');
            guide.push('```bash');
            guide.push(fix.verification);
            guide.push('```');
            guide.push('');
        }
        
        guide.push('---');
        guide.push('');
    }

    // Save fixes to files
    async saveFixes(fixes, outputDir = './') {
        const fixScript = await this.generateFixScript(fixes);
        const manualGuide = this.generateManualGuide(fixes);
        
        const scriptPath = path.join(outputDir, 'automated-fixes.sh');
        const guidePath = path.join(outputDir, 'manual-fix-guide.md');
        
        try {
            await fs.writeFile(scriptPath, fixScript, { mode: 0o755 });
            await fs.writeFile(guidePath, manualGuide);
            
            console.log(`\n📝 Fix files generated:`);
            console.log(`   Automated script: ${scriptPath}`);
            console.log(`   Manual guide: ${guidePath}`);
            console.log(`\n🔧 To run automated fixes: bash ${scriptPath}`);
            
        } catch (error) {
            console.error(`Error saving fix files: ${error.message}`);
        }
    }
}

module.exports = FixGenerator;