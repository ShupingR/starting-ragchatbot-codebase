#!/usr/bin/env node

/**
 * Comprehensive Localhost Connection Diagnostics
 * 
 * This script systematically tests all possible reasons why localhost connection might fail.
 * It provides actionable fixes for each discovered issue.
 * 
 * Usage: node diagnostic-runner.js
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const https = require('https');

const execAsync = promisify(exec);

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

class DiagnosticResult {
    constructor(testName, category) {
        this.testName = testName;
        this.category = category;
        this.status = 'pending'; // pending, pass, fail
        this.message = '';
        this.details = [];
        this.fixes = [];
        this.info = [];
    }

    pass(message, info = []) {
        this.status = 'pass';
        this.message = message;
        this.info = Array.isArray(info) ? info : [info];
    }

    fail(message, details = [], fixes = []) {
        this.status = 'fail';
        this.message = message;
        this.details = Array.isArray(details) ? details : [details];
        this.fixes = Array.isArray(fixes) ? fixes : [fixes];
    }

    addInfo(info) {
        this.info.push(info);
    }

    addFix(fix) {
        this.fixes.push(fix);
    }
}

class DiagnosticRunner {
    constructor() {
        this.results = [];
        this.config = {
            expectedPorts: [8000, 8080],
            backendPath: '../backend',
            apiEndpoints: ['/api/courses', '/api/query'],
            staticFiles: ['/', '/style.css', '/script.js']
        };
    }

    log(message, color = 'white') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    logResult(result) {
        const statusIcon = {
            'pass': '✅',
            'fail': '❌',
            'pending': '⏳'
        }[result.status];

        const statusColor = {
            'pass': 'green',
            'fail': 'red', 
            'pending': 'yellow'
        }[result.status];

        this.log(`\n${statusIcon} ${result.testName}`, statusColor);
        this.log(`   ${result.message}`, statusColor);

        if (result.details.length > 0) {
            result.details.forEach(detail => {
                this.log(`   • ${detail}`, 'dim');
            });
        }

        if (result.fixes.length > 0) {
            this.log('   🔧 Recommended fixes:', 'cyan');
            result.fixes.forEach(fix => {
                this.log(`   • ${fix}`, 'cyan');
            });
        }

        if (result.info.length > 0) {
            result.info.forEach(info => {
                this.log(`   📋 ${info}`, 'dim');
            });
        }
    }

    async runCommand(command, timeout = 5000) {
        try {
            return await Promise.race([
                execAsync(command),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Command timeout')), timeout)
                )
            ]);
        } catch (error) {
            return { stdout: '', stderr: error.message, error: true };
        }
    }

    async testProcessStatus() {
        const result = new DiagnosticResult('Backend Process Status', 'infrastructure');
        
        try {
            // Check for uvicorn processes
            const { stdout } = await this.runCommand('ps aux | grep uvicorn | grep -v grep');
            
            if (stdout.trim()) {
                const processes = stdout.trim().split('\n');
                result.pass(`Found ${processes.length} uvicorn process(es) running`, 
                    processes.map(p => `Process: ${p.trim()}`));
            } else {
                result.fail('No uvicorn processes found running', 
                    ['Server process is not active'],
                    ['Start server with: cd backend && uv run uvicorn app:app --reload --port 8000']
                );
            }
        } catch (error) {
            result.fail('Failed to check process status', [error.message]);
        }

        this.results.push(result);
        return result;
    }

    async testPortBinding() {
        const result = new DiagnosticResult('Port Binding Status', 'network');
        
        const boundPorts = [];
        const conflicts = [];

        for (const port of this.config.expectedPorts) {
            try {
                const { stdout } = await this.runCommand(`lsof -i :${port}`);
                if (stdout.trim()) {
                    const lines = stdout.trim().split('\n');
                    const processes = lines.slice(1).map(line => {
                        const parts = line.split(/\s+/);
                        return `${parts[0]} (PID: ${parts[1]})`;
                    });
                    
                    if (processes.some(p => p.includes('uvicorn') || p.includes('python'))) {
                        boundPorts.push({ port, processes, isOurApp: true });
                    } else {
                        conflicts.push({ port, processes });
                    }
                } else {
                    // Port is free
                    boundPorts.push({ port, processes: [], isOurApp: false });
                }
            } catch (error) {
                result.addInfo(`Could not check port ${port}: ${error.message}`);
            }
        }

        if (conflicts.length > 0) {
            result.fail('Port conflicts detected', 
                conflicts.map(c => `Port ${c.port} used by: ${c.processes.join(', ')}`),
                conflicts.map(c => `Kill processes on port ${c.port}: sudo lsof -ti:${c.port} | xargs kill -9`)
            );
        } else if (boundPorts.some(p => p.isOurApp)) {
            const ourPorts = boundPorts.filter(p => p.isOurApp);
            result.pass(`Server bound to port(s): ${ourPorts.map(p => p.port).join(', ')}`,
                ourPorts.map(p => `Port ${p.port}: ${p.processes.join(', ')}`));
        } else {
            result.fail('No server processes bound to expected ports',
                [`Expected ports: ${this.config.expectedPorts.join(', ')}`],
                ['Ensure server is running with correct port binding']
            );
        }

        this.results.push(result);
        return result;
    }

    async testConnectivity() {
        const result = new DiagnosticResult('Network Connectivity', 'network');
        
        const testUrls = [
            'http://127.0.0.1:8000',
            'http://127.0.0.1:8080', 
            'http://localhost:8000',
            'http://localhost:8080'
        ];

        const results = [];

        for (const url of testUrls) {
            try {
                const response = await this.makeRequest(url, 2000);
                results.push({ url, status: response.statusCode, success: true });
            } catch (error) {
                results.push({ url, error: error.message, success: false });
            }
        }

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
            result.pass(`Successfully connected to ${successful.length} endpoint(s)`,
                successful.map(r => `${r.url} → HTTP ${r.status}`));
        } else {
            result.fail('Failed to connect to any endpoint',
                failed.map(r => `${r.url} → ${r.error}`),
                [
                    'Check if server is actually running and bound to the correct port',
                    'Try different ports: 8000, 8080, 3000, 5000',
                    'Check firewall settings',
                    'Try binding server to 0.0.0.0 instead of 127.0.0.1'
                ]
            );
        }

        this.results.push(result);
        return result;
    }

    async testEnvironment() {
        const result = new DiagnosticResult('Environment Configuration', 'configuration');
        
        try {
            // Check .env file
            const envPath = path.join(this.config.backendPath, '../.env');
            const envContent = await fs.readFile(envPath, 'utf8');
            
            const hasApiKey = envContent.includes('ANTHROPIC_API_KEY=sk-');
            
            if (hasApiKey) {
                result.pass('Environment configuration looks good', 
                    ['ANTHROPIC_API_KEY is present in .env file']);
            } else {
                result.fail('Environment configuration issues detected',
                    ['ANTHROPIC_API_KEY is missing or invalid in .env file'],
                    ['Add valid ANTHROPIC_API_KEY to .env file']
                );
            }

        } catch (error) {
            result.fail('Could not validate environment', 
                [`Error reading .env file: ${error.message}`],
                ['Ensure .env file exists with ANTHROPIC_API_KEY']
            );
        }

        this.results.push(result);
        return result;
    }

    async testAPIEndpoints() {
        const result = new DiagnosticResult('API Endpoint Testing', 'api');
        
        const testPorts = [8000, 8080];
        const endpoints = this.config.apiEndpoints;
        
        const results = [];
        
        for (const port of testPorts) {
            for (const endpoint of endpoints) {
                const url = `http://127.0.0.1:${port}${endpoint}`;
                try {
                    const response = await this.makeRequest(url, 3000);
                    results.push({ 
                        url, 
                        status: response.statusCode, 
                        success: response.statusCode < 400,
                        endpoint 
                    });
                } catch (error) {
                    results.push({ 
                        url, 
                        error: error.code || error.message, 
                        success: false,
                        endpoint 
                    });
                }
            }
        }

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
            result.pass(`API endpoints responding: ${successful.length}/${results.length}`,
                successful.map(r => `${r.endpoint} on port ${r.url.match(/:(\d+)/)[1]} → HTTP ${r.status}`));
            
            if (failed.length > 0) {
                result.addInfo('Some endpoints failed:');
                failed.forEach(r => result.addInfo(`${r.url} → ${r.error}`));
            }
        } else {
            result.fail('No API endpoints responding',
                failed.map(r => `${r.url} → ${r.error}`),
                [
                    'Ensure backend server is running',
                    'Check server logs for startup errors',
                    'Verify FastAPI app is properly initialized'
                ]
            );
        }

        this.results.push(result);
        return result;
    }

    async testStaticFiles() {
        const result = new DiagnosticResult('Static File Serving', 'frontend');
        
        const testPorts = [8000, 8080];
        const staticFiles = this.config.staticFiles;
        
        const results = [];
        
        for (const port of testPorts) {
            for (const file of staticFiles) {
                const url = `http://127.0.0.1:${port}${file}`;
                try {
                    const response = await this.makeRequest(url, 3000);
                    results.push({ 
                        url, 
                        status: response.statusCode, 
                        success: response.statusCode === 200,
                        file 
                    });
                } catch (error) {
                    results.push({ 
                        url, 
                        error: error.code || error.message, 
                        success: false,
                        file 
                    });
                }
            }
        }

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
            const workingPort = successful[0].url.match(/:(\d+)/)[1];
            result.pass(`Frontend files serving on port ${workingPort}`,
                successful.map(r => `${r.file} → HTTP ${r.status}`));
        } else {
            result.fail('Frontend files not accessible',
                failed.map(r => `${r.url} → ${r.error}`),
                [
                    'Check if FastAPI static file mounting is working',
                    'Verify frontend files exist in correct directory',
                    'Check server logs for static file errors'
                ]
            );
        }

        this.results.push(result);
        return result;
    }

    makeRequest(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const request = client.get(url, (response) => {
                response.on('data', () => {}); // consume response
                response.on('end', () => {
                    resolve(response);
                });
            });

            request.setTimeout(timeout, () => {
                request.destroy();
                reject(new Error('TIMEOUT'));
            });

            request.on('error', (error) => {
                reject(error);
            });
        });
    }

    generateSummary() {
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        const total = this.results.length;

        this.log('\n' + '='.repeat(60), 'bright');
        this.log('DIAGNOSTIC SUMMARY', 'bright');
        this.log('='.repeat(60), 'bright');
        
        this.log(`\nTests run: ${total}`);
        this.log(`Passed: ${passed}`, 'green');
        this.log(`Failed: ${failed}`, 'red');

        const failedResults = this.results.filter(r => r.status === 'fail');
        
        if (failedResults.length > 0) {
            this.log('\n🔧 CRITICAL ISSUES TO FIX:', 'red');
            failedResults.forEach(result => {
                this.log(`\n• ${result.testName}`, 'red');
                this.log(`  Problem: ${result.message}`, 'dim');
                if (result.fixes.length > 0) {
                    this.log(`  Fix: ${result.fixes[0]}`, 'cyan');
                }
            });

            this.log('\n📋 RECOMMENDED ACTIONS:', 'yellow');
            this.log('1. Fix the issues above in order of appearance', 'yellow');
            this.log('2. Re-run this diagnostic after each fix', 'yellow');
            this.log('3. Check server logs for additional error details', 'yellow');
        } else {
            this.log('\n🎉 All diagnostics passed! Your server should be accessible.', 'green');
            const workingUrl = this.extractWorkingUrl();
            if (workingUrl) {
                this.log(`\n🌐 Try accessing: ${workingUrl}`, 'green');
            }
        }
    }

    extractWorkingUrl() {
        const connectivityResult = this.results.find(r => r.testName === 'Network Connectivity' && r.status === 'pass');
        if (connectivityResult && connectivityResult.info.length > 0) {
            const match = connectivityResult.info[0].match(/http:\/\/[^→]+/);
            return match ? match[0] : null;
        }
        return null;
    }

    async run() {
        this.log('🔍 Starting Comprehensive Localhost Connection Diagnostics', 'bright');
        this.log('This will test all possible reasons for connection failures.\n', 'dim');

        // Run all diagnostic tests
        await this.testProcessStatus();
        await this.testPortBinding();
        await this.testConnectivity();
        await this.testEnvironment();
        await this.testAPIEndpoints();
        await this.testStaticFiles();

        // Display all results
        this.results.forEach(result => this.logResult(result));

        // Generate summary and recommendations
        this.generateSummary();
    }
}

// Run diagnostics if this file is executed directly
if (require.main === module) {
    const runner = new DiagnosticRunner();
    runner.run().catch(console.error);
}

module.exports = DiagnosticRunner;