#!/usr/bin/env node

/**
 * Main Test Runner for Localhost Connection Diagnostics
 * 
 * This script runs comprehensive diagnostics to identify why
 * the localhost server connection is failing and provides automated fixes.
 * 
 * Usage: node run-diagnostics.js [--fix] [--detailed]
 */

const DiagnosticRunner = require('./diagnostic-runner');
const BackendDiagnostics = require('./backend-diagnostics');
const NetworkDiagnostics = require('./network-diagnostics');  
const FixGenerator = require('./fix-generator');

class ComprehensiveDiagnostics {
    constructor() {
        this.options = this.parseArguments();
        this.allResults = [];
    }

    parseArguments() {
        const args = process.argv.slice(2);
        return {
            generateFixes: args.includes('--fix'),
            detailed: args.includes('--detailed'),
            help: args.includes('--help') || args.includes('-h')
        };
    }

    showHelp() {
        console.log(`
🔍 Localhost Connection Diagnostics

This tool diagnoses why your localhost server connection is failing
and provides specific fixes for each detected issue.

Usage: node run-diagnostics.js [options]

Options:
  --fix         Generate automated fix scripts
  --detailed    Run detailed backend and network diagnostics
  --help, -h    Show this help message

Examples:
  node run-diagnostics.js                    # Basic diagnostics
  node run-diagnostics.js --detailed         # Comprehensive diagnostics  
  node run-diagnostics.js --fix              # Generate fix scripts
  node run-diagnostics.js --detailed --fix   # Full diagnostics + fixes

The diagnostics will test:
✓ Backend server process status
✓ Port binding and conflicts
✓ Network connectivity
✓ API endpoint availability  
✓ Environment configuration
✓ Static file serving
✓ Firewall and security settings
✓ Python environment (detailed mode)
✓ Application imports (detailed mode)
✓ DNS resolution (detailed mode)

Results will show:
✅ PASS - Component working correctly
❌ FAIL - Issue detected with specific fixes
🔧 Recommended fixes for each failure
📋 Additional diagnostic information
        `);
    }

    async runBasicDiagnostics() {
        console.log('🔍 Running Basic Diagnostics...\n');
        
        const runner = new DiagnosticRunner();
        await runner.run();
        
        return runner.results;
    }

    async runDetailedDiagnostics() {
        console.log('🔍 Running Detailed Diagnostics...\n');
        
        // Run basic diagnostics first
        const basicResults = await this.runBasicDiagnostics();
        
        // Run specialized diagnostics
        console.log('\n' + '='.repeat(60));
        const backendDiagnostics = new BackendDiagnostics();
        const backendResults = await backendDiagnostics.runAllTests();
        
        console.log('\n' + '='.repeat(60));
        const networkDiagnostics = new NetworkDiagnostics();
        const networkResults = await networkDiagnostics.runAllTests();
        
        // Combine all results
        return [...basicResults, ...backendResults, ...networkResults];
    }

    async generateAndSaveFixes(results) {
        console.log('\n🔧 Generating Fixes...\n');
        
        const fixGenerator = new FixGenerator();
        const fixes = fixGenerator.generateFixes(results);
        
        if (fixes.length === 0) {
            console.log('✅ No fixes needed - all diagnostics passed!');
            return;
        }

        console.log(`Generated ${fixes.length} fix(es):`);
        fixes.forEach((fix, index) => {
            console.log(`${index + 1}. ${fix.title} (${fix.priority} priority)`);
            console.log(`   ${fix.description}`);
        });
        
        // Save fix files
        await fixGenerator.saveFixes(fixes, './frontend/tests/');
        
        return fixes;
    }

    summarizeResults(results) {
        const passed = results.filter(r => r.status === 'pass').length;
        const failed = results.filter(r => r.status === 'fail').length;
        const total = results.length;
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 FINAL SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`\nDiagnostic Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        
        if (failed === 0) {
            console.log('\n🎉 All diagnostics passed!');
            console.log('Your server should be accessible. Try: http://127.0.0.1:8000');
            return;
        }

        // Show critical issues
        const criticalIssues = results.filter(r => 
            r.status === 'fail' && 
            (r.category === 'infrastructure' || r.category === 'backend')
        );
        
        if (criticalIssues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES (Fix these first):');
            criticalIssues.forEach(issue => {
                console.log(`   • ${issue.testName || issue.test}: ${issue.message}`);
            });
        }

        // Show network issues
        const networkIssues = results.filter(r => 
            r.status === 'fail' && r.category === 'network'
        );
        
        if (networkIssues.length > 0) {
            console.log('\n🌐 NETWORK ISSUES:');
            networkIssues.forEach(issue => {
                console.log(`   • ${issue.testName || issue.test}: ${issue.message}`);
            });
        }

        console.log('\n📋 NEXT STEPS:');
        console.log('1. Review the specific error details above');
        console.log('2. Apply the recommended fixes');
        if (this.options.generateFixes) {
            console.log('3. Run the generated fix script: bash frontend/tests/automated-fixes.sh');
            console.log('4. Or follow the manual guide: frontend/tests/manual-fix-guide.md');
        } else {
            console.log('3. Rerun with --fix flag to generate automated fixes');
        }
        console.log('5. Rerun diagnostics to verify fixes worked');
    }

    async run() {
        if (this.options.help) {
            this.showHelp();
            return;
        }

        console.log('🚀 Localhost Connection Diagnostic Suite');
        console.log('==========================================\n');

        try {
            // Run appropriate level of diagnostics
            let results;
            if (this.options.detailed) {
                results = await this.runDetailedDiagnostics();
            } else {
                results = await this.runBasicDiagnostics();
            }

            this.allResults = results;

            // Generate fixes if requested
            if (this.options.generateFixes) {
                await this.generateAndSaveFixes(results);
            }

            // Show final summary
            this.summarizeResults(results);

        } catch (error) {
            console.error(`\n❌ Diagnostic runner failed: ${error.message}`);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const diagnostics = new ComprehensiveDiagnostics();
    diagnostics.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ComprehensiveDiagnostics;