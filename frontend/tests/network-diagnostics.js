/**
 * Network Diagnostics Module
 * 
 * Deep network configuration diagnostics including firewall, DNS,
 * VPN interference, and system-level networking issues.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');
const dns = require('dns');
const os = require('os');

const execAsync = promisify(exec);
const dnsLookup = promisify(dns.lookup);

class NetworkDiagnostics {
    constructor(config = {}) {
        this.testPorts = config.testPorts || [8000, 8080];
        this.testHosts = config.testHosts || ['127.0.0.1', 'localhost', '::1'];
        this.results = [];
    }

    async runCommand(command, timeout = 5000) {
        try {
            const result = await Promise.race([
                execAsync(command),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
            ]);
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

    async testDNSResolution() {
        const result = {
            test: 'DNS Resolution',
            category: 'network',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            // Test localhost resolution
            for (const host of this.testHosts) {
                try {
                    const resolved = await dnsLookup(host);
                    result.details.push(`✓ ${host} → ${resolved.address} (${resolved.family})`);
                } catch (error) {
                    result.details.push(`✗ ${host} resolution failed: ${error.message}`);
                    result.status = 'fail';
                    result.fixes.push(`Fix ${host} resolution in /etc/hosts or DNS configuration`);
                }
            }

            // Check /etc/hosts file
            try {
                const hostsResult = await this.runCommand('cat /etc/hosts | grep -E "(localhost|127.0.0.1)"');
                if (hostsResult.success) {
                    result.details.push('Localhost entries in /etc/hosts:');
                    hostsResult.stdout.split('\n').filter(line => line.trim()).forEach(line => {
                        result.details.push(`  ${line.trim()}`);
                    });
                }
            } catch (error) {
                result.details.push('Could not read /etc/hosts file');
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`DNS resolution test failed: ${error.message}`);
            result.fixes.push('Check DNS configuration and /etc/hosts file');
        }

        return result;
    }

    async testPortAccessibility() {
        const result = {
            test: 'Port Accessibility',
            category: 'network', 
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            for (const port of this.testPorts) {
                for (const host of this.testHosts) {
                    const isAccessible = await this.testPortConnection(host, port, 2000);
                    
                    if (isAccessible) {
                        result.details.push(`✓ ${host}:${port} - Port accessible`);
                    } else {
                        result.details.push(`✗ ${host}:${port} - Port not accessible`);
                        
                        // Additional port diagnostics
                        const netstatResult = await this.runCommand(`netstat -an | grep :${port}`);
                        if (netstatResult.success && netstatResult.stdout.trim()) {
                            result.details.push(`  Port ${port} status: ${netstatResult.stdout.trim()}`);
                        } else {
                            result.details.push(`  Port ${port} not bound to any process`);
                            result.fixes.push(`Start server on port ${port} or check if it's bound to different interface`);
                        }
                    }
                }
            }

            // Check for common port conflicts
            const commonPorts = [80, 443, 3000, 5000, 8000, 8080, 9000];
            const occupiedPorts = [];
            
            for (const port of commonPorts) {
                const lsofResult = await this.runCommand(`lsof -i :${port}`);
                if (lsofResult.success && lsofResult.stdout.trim()) {
                    const lines = lsofResult.stdout.split('\n').slice(1);
                    occupiedPorts.push({
                        port,
                        processes: lines.map(line => line.split(/\s+/).slice(0, 2).join(' ')).filter(p => p.trim())
                    });
                }
            }

            if (occupiedPorts.length > 0) {
                result.details.push('Occupied ports on system:');
                occupiedPorts.forEach(({ port, processes }) => {
                    result.details.push(`  Port ${port}: ${processes.join(', ')}`);
                });
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Port accessibility test failed: ${error.message}`);
            result.fixes.push('Check port configuration and binding');
        }

        return result;
    }

    testPortConnection(host, port, timeout = 1000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            
            const onConnect = () => {
                socket.destroy();
                resolve(true);
            };
            
            const onError = () => {
                socket.destroy();
                resolve(false);
            };
            
            const onTimeout = () => {
                socket.destroy();
                resolve(false);
            };
            
            socket.setTimeout(timeout);
            socket.once('connect', onConnect);
            socket.once('error', onError);
            socket.once('timeout', onTimeout);
            
            socket.connect(port, host);
        });
    }

    async testFirewallConfiguration() {
        const result = {
            test: 'Firewall Configuration',
            category: 'network',
            status: 'pending', 
            details: [],
            fixes: []
        };

        try {
            const platform = os.platform();
            
            if (platform === 'darwin') {
                // macOS firewall check
                const pfctlResult = await this.runCommand('sudo pfctl -s rules 2>/dev/null || echo "pfctl not accessible"');
                const firewallResult = await this.runCommand('sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "firewall command not accessible"');
                
                if (firewallResult.stdout.includes('enabled')) {
                    result.details.push('⚠️  macOS Application Firewall is enabled');
                    result.fixes.push('Allow incoming connections: System Preferences → Security & Privacy → Firewall');
                } else if (firewallResult.stdout.includes('disabled')) {
                    result.details.push('✓ macOS Application Firewall is disabled');
                } else {
                    result.details.push('Could not determine macOS firewall status');
                }
                
            } else if (platform === 'linux') {
                // Linux firewall checks
                const iptablesResult = await this.runCommand('iptables -L INPUT -n | grep -E "(DROP|REJECT|:8000|:8080)"');
                if (iptablesResult.success && iptablesResult.stdout.trim()) {
                    result.details.push('⚠️  iptables rules that might block connections:');
                    result.details.push(iptablesResult.stdout);
                    result.fixes.push('Adjust iptables rules to allow local connections');
                }
                
                const ufw = await this.runCommand('ufw status 2>/dev/null || echo "ufw not found"');
                if (ufw.stdout.includes('active')) {
                    result.details.push('⚠️  UFW firewall is active');
                    result.fixes.push('Allow ports: sudo ufw allow 8000');
                }
                
            }

            // Test if localhost connections are blocked
            const curlTest = await this.runCommand('curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8000 || echo "connection failed"');
            if (curlTest.stdout.includes('connection failed') || curlTest.stdout.includes('refused')) {
                result.details.push('✗ Direct HTTP connection to localhost:8000 failed');
                result.fixes.push('Check if application is running and firewall is not blocking');
            } else if (curlTest.stdout.trim() && !curlTest.stdout.includes('connection failed')) {
                result.details.push(`✓ HTTP connection returns: ${curlTest.stdout.trim()}`);
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Firewall test failed: ${error.message}`);
            result.fixes.push('Check system firewall configuration');
        }

        return result;
    }

    async testNetworkInterfaces() {
        const result = {
            test: 'Network Interfaces',
            category: 'network',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            const interfaces = os.networkInterfaces();
            
            result.details.push('Available network interfaces:');
            Object.keys(interfaces).forEach(name => {
                const iface = interfaces[name];
                iface.forEach(config => {
                    if (!config.internal || name === 'lo' || name === 'lo0') {
                        result.details.push(`  ${name}: ${config.address} (${config.family})`);
                    }
                });
            });

            // Check if loopback interface is working
            const loopbackWorking = await this.testPortConnection('127.0.0.1', 22, 1000); // SSH is commonly available
            if (loopbackWorking) {
                result.details.push('✓ Loopback interface appears functional');
            } else {
                const pingResult = await this.runCommand('ping -c 1 -W 1000 127.0.0.1');
                if (pingResult.success) {
                    result.details.push('✓ Loopback interface responds to ping');
                } else {
                    result.details.push('✗ Loopback interface not responding');
                    result.status = 'fail';
                    result.fixes.push('Check loopback interface configuration');
                }
            }

            // Check route table for localhost
            const routeResult = await this.runCommand('netstat -rn | grep -E "(127.0.0.1|localhost)" | head -5');
            if (routeResult.success && routeResult.stdout.trim()) {
                result.details.push('Localhost routing:');
                routeResult.stdout.split('\n').filter(line => line.trim()).forEach(line => {
                    result.details.push(`  ${line.trim()}`);
                });
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Network interface test failed: ${error.message}`);
            result.fixes.push('Check network interface configuration');
        }

        return result;
    }

    async testVPNAndProxyInterference() {
        const result = {
            test: 'VPN/Proxy Interference',
            category: 'network',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            // Check for common VPN interfaces
            const interfaces = os.networkInterfaces();
            const vpnInterfaces = Object.keys(interfaces).filter(name => 
                name.includes('tun') || name.includes('tap') || name.includes('vpn') || 
                name.includes('ppp') || name.includes('utun')
            );
            
            if (vpnInterfaces.length > 0) {
                result.details.push('⚠️  Potential VPN interfaces detected:');
                vpnInterfaces.forEach(name => {
                    result.details.push(`  ${name}`);
                });
                result.fixes.push('Try disconnecting VPN temporarily to test connectivity');
            } else {
                result.details.push('✓ No obvious VPN interfaces detected');
            }

            // Check environment for proxy settings
            const proxyEnvVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY'];
            const activeProxies = [];
            
            proxyEnvVars.forEach(envVar => {
                if (process.env[envVar]) {
                    activeProxies.push(`${envVar}=${process.env[envVar]}`);
                }
            });

            if (activeProxies.length > 0) {
                result.details.push('⚠️  Proxy environment variables set:');
                activeProxies.forEach(proxy => {
                    result.details.push(`  ${proxy}`);
                });
                result.fixes.push('Temporarily unset proxy variables for localhost testing');
            } else {
                result.details.push('✓ No proxy environment variables detected');
            }

            // Test direct vs potential proxy routing
            const directTest = await this.runCommand('curl -s --max-time 2 http://127.0.0.1:8000 --noproxy "*" 2>&1 || echo "direct failed"');
            if (directTest.stdout.includes('direct failed') || directTest.stdout.includes('refused')) {
                result.details.push('✗ Direct connection (bypassing proxy) failed');
            } else {
                result.details.push('✓ Direct connection bypassing proxy works');
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`VPN/Proxy test failed: ${error.message}`);
            result.fixes.push('Check VPN and proxy settings');
        }

        return result;
    }

    async testSecuritySoftware() {
        const result = {
            test: 'Security Software Interference',
            category: 'network',
            status: 'pending',
            details: [],
            fixes: []
        };

        try {
            // Check for common antivirus/security processes on macOS
            const processes = [
                'Little Snitch', 'LuLu', 'Radio Silence', 'Hands Off',
                'BlockBlock', 'Micro Snitch', 'OverSight'
            ];

            const runningSecuritySoftware = [];
            
            for (const process of processes) {
                const psResult = await this.runCommand(`ps aux | grep -i "${process}" | grep -v grep`);
                if (psResult.success && psResult.stdout.trim()) {
                    runningSecuritySoftware.push(process);
                }
            }

            if (runningSecuritySoftware.length > 0) {
                result.details.push('⚠️  Security software detected:');
                runningSecuritySoftware.forEach(software => {
                    result.details.push(`  ${software}`);
                });
                result.fixes.push('Check security software settings for localhost blocking');
                result.fixes.push('Temporarily disable security software to test connectivity');
            } else {
                result.details.push('✓ No obvious security software interference detected');
            }

            // Check for macOS quarantine attributes that might affect execution
            const quarantineResult = await this.runCommand('xattr -l ../backend/app.py 2>/dev/null | grep quarantine || echo "no quarantine"');
            if (!quarantineResult.stdout.includes('no quarantine')) {
                result.details.push('⚠️  Quarantine attributes detected on app files');
                result.fixes.push('Remove quarantine: xattr -r -d com.apple.quarantine ../backend/');
            }

            if (result.status === 'pending') {
                result.status = 'pass';
            }

        } catch (error) {
            result.status = 'fail';
            result.details.push(`Security software test failed: ${error.message}`);
        }

        return result;
    }

    async runAllTests() {
        console.log('🌐 Running Network Diagnostics...\n');
        
        const tests = [
            this.testDNSResolution(),
            this.testPortAccessibility(),
            this.testFirewallConfiguration(),
            this.testNetworkInterfaces(),
            this.testVPNAndProxyInterference(),
            this.testSecuritySoftware()
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

module.exports = NetworkDiagnostics;