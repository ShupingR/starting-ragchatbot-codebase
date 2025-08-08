/**
 * Backend Diagnostics Module
 * 
 * Deep diagnostics for backend server process, Python environment,
 * and application initialization issues.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class BackendDiagnostics {
    constructor(config = {}) {
        this.backendPath = config.backendPath || '../backend';
        this.expectedPorts = config.expectedPorts || [8000, 8080];
        this.results = [];
    }

    async runCommand(command, cwd = process.cwd()) {
        try {
            const result = await execAsync(command, { cwd, timeout: 10000 });
            return { ...result, success: true };
        } catch (error) {
            return { 
                stdout: error.stdout || '', 
                stderr: error.stderr || error.message,
                success: false,
                error: error.message 
            };
        }
    }

    async testPythonEnvironment() {
        const result = {
            test: 'Python Environment',
            category: 'backend',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            // Test uv environment
            const uvResult = await this.runCommand('uv --version');
            if (uvResult.success) {
                result.details.push(`✓ uv version: ${uvResult.stdout.trim()}`);
            } else {
                result.details.push(`✗ uv not found or not working`);
                result.fixes.push('Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh');
                result.status = 'fail';
                return result;
            }

            // Test Python version in uv environment  
            const backendDir = path.resolve(this.backendPath);
            const pythonResult = await this.runCommand('uv run python --version', backendDir);
            
            if (pythonResult.success) {
                result.details.push(`✓ Python: ${pythonResult.stdout.trim()}`);
            } else {
                result.details.push(`✗ Python not accessible via uv`);
                result.fixes.push('Run: cd backend && uv sync');
                result.status = 'fail';
                return result;
            }

            // Test key dependencies
            const deps = ['fastapi', 'uvicorn', 'anthropic', 'chromadb'];
            for (const dep of deps) {
                const depResult = await this.runCommand(`uv run python -c "import ${dep}; print('${dep} OK')"`, backendDir);
                if (depResult.success) {
                    result.details.push(`✓ ${dep} importable`);
                } else {
                    result.details.push(`✗ ${dep} import failed: ${depResult.stderr}`);
                    result.fixes.push(`Install ${dep}: cd backend && uv add ${dep}`);
                    result.status = 'fail';
                }
            }

            if (result.status !== 'fail') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Error testing Python environment: ${error.message}`);
            result.fixes.push('Check Python and uv installation');
        }

        return result;
    }

    async testAppImports() {
        const result = {
            test: 'Application Import Test',
            category: 'backend', 
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            const backendDir = path.resolve(this.backendPath);
            
            // Test importing the main app
            const appImportResult = await this.runCommand(
                'uv run python -c "import app; print(\'App imported successfully\')"', 
                backendDir
            );
            
            if (appImportResult.success) {
                result.details.push('✓ app.py imports successfully');
                
                // Test FastAPI app creation
                const fastApiResult = await this.runCommand(
                    'uv run python -c "import app; print(f\'FastAPI app created: {type(app.app)}\')"',
                    backendDir
                );
                
                if (fastApiResult.success) {
                    result.details.push('✓ FastAPI app object created');
                    result.status = 'pass';
                } else {
                    result.details.push(`✗ FastAPI app creation failed: ${fastApiResult.stderr}`);
                    result.status = 'fail';
                    result.fixes.push('Check app.py for initialization errors');
                }
                
            } else {
                result.status = 'fail';
                result.details.push(`✗ app.py import failed: ${appImportResult.stderr}`);
                
                // Parse import error for specific fixes
                if (appImportResult.stderr.includes('No module named')) {
                    const missingModule = appImportResult.stderr.match(/No module named '([^']+)'/);
                    if (missingModule) {
                        result.fixes.push(`Install missing module: cd backend && uv add ${missingModule[1]}`);
                    }
                } else if (appImportResult.stderr.includes('config')) {
                    result.fixes.push('Check config.py file exists and is properly configured');
                } else {
                    result.fixes.push('Check app.py for syntax errors and missing dependencies');
                }
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Error testing app imports: ${error.message}`);
            result.fixes.push('Verify backend directory structure and files');
        }

        return result;
    }

    async testRAGSystemInitialization() {
        const result = {
            test: 'RAG System Initialization',
            category: 'backend',
            status: 'pending', 
            details: [],
            fixes: []
        };

        try {
            const backendDir = path.resolve(this.backendPath);
            
            // Test RAG system components individually
            const components = [
                'config',
                'rag_system', 
                'vector_store',
                'ai_generator',
                'search_tools'
            ];

            for (const component of components) {
                const importResult = await this.runCommand(
                    `uv run python -c "import ${component}; print('${component} OK')"`,
                    backendDir
                );
                
                if (importResult.success) {
                    result.details.push(`✓ ${component} module imports`);
                } else {
                    result.details.push(`✗ ${component} import failed: ${importResult.stderr}`);
                    result.status = 'fail';
                    result.fixes.push(`Fix ${component}.py file or its dependencies`);
                }
            }

            // Test RAG system instantiation
            if (result.status !== 'fail') {
                const ragResult = await this.runCommand(
                    'uv run python -c "from config import config; from rag_system import RAGSystem; rag = RAGSystem(config); print(\'RAG system created successfully\')"',
                    backendDir
                );
                
                if (ragResult.success) {
                    result.details.push('✓ RAG system instantiates successfully');
                    result.status = 'pass';
                } else {
                    result.status = 'fail';
                    result.details.push(`✗ RAG system instantiation failed: ${ragResult.stderr}`);
                    
                    // Specific error analysis
                    if (ragResult.stderr.includes('ANTHROPIC_API_KEY')) {
                        result.fixes.push('Set ANTHROPIC_API_KEY in .env file');
                    } else if (ragResult.stderr.includes('chroma')) {
                        result.fixes.push('ChromaDB initialization issue - check database permissions');
                    } else {
                        result.fixes.push('Check config.py and all RAG system dependencies');
                    }
                }
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Error testing RAG system: ${error.message}`);
            result.fixes.push('Check RAG system component files and configuration');
        }

        return result;
    }

    async testProcessLifecycle() {
        const result = {
            test: 'Process Lifecycle Analysis',
            category: 'backend',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            // Check for zombie or defunct processes
            const processResult = await this.runCommand('ps aux | grep -E "(uvicorn|python.*app)" | grep -v grep');
            
            if (processResult.success && processResult.stdout.trim()) {
                const processes = processResult.stdout.trim().split('\n');
                result.details.push(`Found ${processes.length} related process(es):`);
                
                processes.forEach(proc => {
                    const parts = proc.trim().split(/\s+/);
                    const pid = parts[1];
                    const status = parts[7]; 
                    const command = parts.slice(10).join(' ');
                    
                    result.details.push(`  PID ${pid} [${status}]: ${command.substring(0, 80)}`);
                    
                    if (status.includes('Z')) {
                        result.details.push(`  ⚠️  Zombie process detected`);
                        result.fixes.push(`Kill zombie process: kill -9 ${pid}`);
                        result.status = 'fail';
                    }
                });
                
                // Check process memory usage
                const memResult = await this.runCommand(`ps -o pid,pmem,vsz,rss,comm -p ${processes.map(p => p.trim().split(/\s+/)[1]).join(',')}`);
                if (memResult.success) {
                    result.details.push('Memory usage:');
                    result.details.push(memResult.stdout);
                }
                
            } else {
                result.details.push('No backend processes currently running');
                result.fixes.push('Start the backend server: cd backend && uv run uvicorn app:app --reload --port 8000');
            }

            // Check system resource limits
            const ulimitResult = await this.runCommand('ulimit -n');
            if (ulimitResult.success) {
                const fileLimit = parseInt(ulimitResult.stdout.trim());
                result.details.push(`File descriptor limit: ${fileLimit}`);
                
                if (fileLimit < 1024) {
                    result.details.push('⚠️  File descriptor limit might be too low');
                    result.fixes.push('Increase file descriptor limit: ulimit -n 4096');
                }
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail'; 
            result.details.push(`Error analyzing process lifecycle: ${error.message}`);
            result.fixes.push('Check system process management and resource limits');
        }

        return result;
    }

    async testStartupSequence() {
        const result = {
            test: 'Server Startup Sequence',
            category: 'backend',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            const backendDir = path.resolve(this.backendPath);
            
            // Test if server can start (dry run)
            result.details.push('Testing server startup sequence...');
            
            const startupTest = await this.runCommand(
                'timeout 5 uv run python -c "import app; import uvicorn; print(\'Server components load successfully\')"',
                backendDir
            );
            
            if (startupTest.success) {
                result.details.push('✓ Server components can be loaded');
                
                // Test document loading
                const docTest = await this.runCommand(
                    'uv run python -c "from config import config; from rag_system import RAGSystem; rag = RAGSystem(config); print(f\'Course count: {rag.get_course_analytics()[\\\"total_courses\\\"]}\')"',
                    backendDir
                );
                
                if (docTest.success) {
                    result.details.push(`✓ Document loading works: ${docTest.stdout.trim()}`);
                    result.status = 'pass';
                } else {
                    result.details.push(`⚠️  Document loading issues: ${docTest.stderr}`);
                    result.fixes.push('Check docs/ directory and document processing');
                    result.status = 'fail';
                }
                
            } else {
                result.status = 'fail';
                result.details.push(`✗ Server startup failed: ${startupTest.stderr}`);
                result.fixes.push('Fix import errors and dependency issues');
                
                // Analyze startup error
                if (startupTest.stderr.includes('Address already in use')) {
                    result.fixes.push('Kill existing process or use different port');
                } else if (startupTest.stderr.includes('Permission denied')) {
                    result.fixes.push('Check file permissions and port access');
                }
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Error testing startup sequence: ${error.message}`);
            result.fixes.push('Check server startup configuration and dependencies');
        }

        return result;
    }

    async runAllTests() {
        console.log('🔧 Running Backend Diagnostics...\n');
        
        const tests = [
            this.testPythonEnvironment(),
            this.testAppImports(), 
            this.testRAGSystemInitialization(),
            this.testProcessLifecycle(),
            this.testStartupSequence()
        ];

        const results = await Promise.all(tests);
        this.results = results;

        // Display results
        results.forEach(result => {
            const statusIcon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏳';
            console.log(`${statusIcon} ${result.test}`);
            
            result.details.forEach(detail => {
                console.log(`   ${detail}`);
            });
            
            if (result.fixes.length > 0) {
                console.log('   🔧 Fixes:');
                result.fixes.forEach(fix => {
                    console.log(`   • ${fix}`);
                });
            }
            console.log('');
        });

        return results;
    }
}

module.exports = BackendDiagnostics;