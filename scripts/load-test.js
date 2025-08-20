// Load Testing Script for EnigmaCode Platform
const axios = require('axios');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(baseUrl = 'http://localhost:3000/api', options = {}) {
        this.baseUrl = baseUrl;
        this.options = {
            concurrentUsers: options.concurrentUsers || 50,
            testDuration: options.testDuration || 60000, // 1 minute
            rampUpTime: options.rampUpTime || 10000, // 10 seconds
            ...options
        };
        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            requestsPerSecond: 0,
            errors: []
        };
        this.authTokens = [];
        this.testProjects = [];
        this.testKeys = [];
    }

    async run() {
        console.log('🔥 Starting Load Test...');
        console.log(`📊 Configuration:`);
        console.log(`   Concurrent Users: ${this.options.concurrentUsers}`);
        console.log(`   Test Duration: ${this.options.testDuration / 1000}s`);
        console.log(`   Ramp-up Time: ${this.options.rampUpTime / 1000}s\n`);

        try {
            await this.setupTestData();
            await this.executeLoadTest();
            this.generateReport();
        } catch (error) {
            console.error('❌ Load test failed:', error.message);
        }
    }

    async setupTestData() {
        console.log('🔧 Setting up test data...');
        
        // Create test users and get auth tokens
        const userPromises = [];
        for (let i = 0; i < Math.min(this.options.concurrentUsers, 10); i++) {
            userPromises.push(this.createTestUser(i));
        }
        
        this.authTokens = await Promise.all(userPromises);
        
        // Create test projects
        const projectPromises = [];
        for (let i = 0; i < this.authTokens.length; i++) {
            projectPromises.push(this.createTestProject(i, this.authTokens[i]));
        }
        
        this.testProjects = await Promise.all(projectPromises);
        
        // Create test keys
        const keyPromises = [];
        for (let i = 0; i < this.testProjects.length; i++) {
            keyPromises.push(this.createTestKey(i, this.authTokens[i], this.testProjects[i]));
        }
        
        this.testKeys = await Promise.all(keyPromises);
        
        console.log(`✅ Created ${this.authTokens.length} users, ${this.testProjects.length} projects, ${this.testKeys.length} keys\n`);
    }

    async createTestUser(index) {
        try {
            const response = await axios.post(`${this.baseUrl}/auth/register`, {
                username: `loadtest_user_${index}_${Date.now()}`,
                email: `loadtest_${index}_${Date.now()}@example.com`,
                password: 'LoadTest123!'
            });
            return response.data.token;
        } catch (error) {
            console.warn(`Failed to create user ${index}:`, error.message);
            return null;
        }
    }

    async createTestProject(index, token) {
        if (!token) return null;
        
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('name', `Load Test Project ${index}`);
            form.append('description', 'Load testing project');
            form.append('file', Buffer.from(`print("Load test ${index}")`), `loadtest${index}.lua`);
            
            const response = await axios.post(`${this.baseUrl}/projects`, form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Obfuscate the project
            await axios.post(`${this.baseUrl}/projects/${response.data.project.projectId}/obfuscate`, 
                { tier: 'standard' },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            return response.data.project;
        } catch (error) {
            console.warn(`Failed to create project ${index}:`, error.message);
            return null;
        }
    }

    async createTestKey(index, token, project) {
        if (!token || !project) return null;
        
        try {
            const response = await axios.post(`${this.baseUrl}/keys`, {
                projectId: project.projectId,
                type: 'permanent'
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            return {
                ...response.data.key,
                projectId: project.projectId
            };
        } catch (error) {
            console.warn(`Failed to create key ${index}:`, error.message);
            return null;
        }
    }

    async executeLoadTest() {
        console.log('🚀 Starting load test execution...');
        
        const startTime = Date.now();
        const endTime = startTime + this.options.testDuration;
        const rampUpEndTime = startTime + this.options.rampUpTime;
        
        const workers = [];
        const responseTimes = [];
        
        // Create worker functions
        for (let i = 0; i < this.options.concurrentUsers; i++) {
            const worker = this.createWorker(i, startTime, endTime, rampUpEndTime, responseTimes);
            workers.push(worker);
        }
        
        // Start all workers
        await Promise.all(workers);
        
        // Calculate results
        this.results.totalRequests = responseTimes.length;
        this.results.successfulRequests = responseTimes.filter(rt => rt.success).length;
        this.results.failedRequests = this.results.totalRequests - this.results.successfulRequests;
        
        const successfulTimes = responseTimes.filter(rt => rt.success).map(rt => rt.time);
        if (successfulTimes.length > 0) {
            this.results.averageResponseTime = successfulTimes.reduce((sum, time) => sum + time, 0) / successfulTimes.length;
            this.results.minResponseTime = Math.min(...successfulTimes);
            this.results.maxResponseTime = Math.max(...successfulTimes);
        }
        
        const actualDuration = (Date.now() - startTime) / 1000;
        this.results.requestsPerSecond = this.results.totalRequests / actualDuration;
        
        console.log('✅ Load test execution completed\n');
    }

    async createWorker(workerId, startTime, endTime, rampUpEndTime, responseTimes) {
        // Stagger worker start times during ramp-up
        const workerStartDelay = (this.options.rampUpTime / this.options.concurrentUsers) * workerId;
        await this.sleep(workerStartDelay);
        
        while (Date.now() < endTime) {
            try {
                const requestStart = performance.now();
                
                // Randomly choose request type
                const requestType = Math.random();
                let success = false;
                
                if (requestType < 0.4) {
                    // 40% - Loader validation requests
                    success = await this.performLoaderValidation();
                } else if (requestType < 0.6) {
                    // 20% - Project listing
                    success = await this.performProjectListing();
                } else if (requestType < 0.8) {
                    // 20% - Key listing
                    success = await this.performKeyListing();
                } else {
                    // 20% - Analytics requests
                    success = await this.performAnalyticsRequest();
                }
                
                const requestEnd = performance.now();
                const responseTime = requestEnd - requestStart;
                
                responseTimes.push({
                    time: responseTime,
                    success,
                    workerId,
                    timestamp: Date.now()
                });
                
                // Small delay between requests
                await this.sleep(Math.random() * 100);
                
            } catch (error) {
                responseTimes.push({
                    time: 0,
                    success: false,
                    workerId,
                    timestamp: Date.now(),
                    error: error.message
                });
                this.results.errors.push(error.message);
            }
        }
    }

    async performLoaderValidation() {
        const randomKey = this.testKeys[Math.floor(Math.random() * this.testKeys.length)];
        if (!randomKey) return false;
        
        const response = await axios.get(`${this.baseUrl}/loader/validate`, {
            headers: {
                'X-Project-ID': randomKey.projectId,
                'X-User-Key': randomKey.keyString,
                'X-User-ID': Math.floor(Math.random() * 10000).toString()
            }
        });
        
        return response.status === 200;
    }

    async performProjectListing() {
        const randomToken = this.authTokens[Math.floor(Math.random() * this.authTokens.length)];
        if (!randomToken) return false;
        
        const response = await axios.get(`${this.baseUrl}/projects`, {
            headers: { 'Authorization': `Bearer ${randomToken}` }
        });
        
        return response.status === 200;
    }

    async performKeyListing() {
        const randomToken = this.authTokens[Math.floor(Math.random() * this.authTokens.length)];
        if (!randomToken) return false;
        
        const response = await axios.get(`${this.baseUrl}/keys`, {
            headers: { 'Authorization': `Bearer ${randomToken}` }
        });
        
        return response.status === 200;
    }

    async performAnalyticsRequest() {
        const randomToken = this.authTokens[Math.floor(Math.random() * this.authTokens.length)];
        if (!randomToken) return false;
        
        const response = await axios.get(`${this.baseUrl}/analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${randomToken}` }
        });
        
        return response.status === 200;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        console.log('📊 LOAD TEST RESULTS');
        console.log('='.repeat(50));
        
        console.log(`\n📈 Request Statistics:`);
        console.log(`  Total Requests: ${this.results.totalRequests}`);
        console.log(`  Successful: ${this.results.successfulRequests} (${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(1)}%)`);
        console.log(`  Failed: ${this.results.failedRequests} (${((this.results.failedRequests / this.results.totalRequests) * 100).toFixed(1)}%)`);
        console.log(`  Requests/Second: ${this.results.requestsPerSecond.toFixed(2)}`);
        
        console.log(`\n⏱️ Response Times:`);
        console.log(`  Average: ${this.results.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Minimum: ${this.results.minResponseTime === Infinity ? 'N/A' : this.results.minResponseTime.toFixed(2) + 'ms'}`);
        console.log(`  Maximum: ${this.results.maxResponseTime.toFixed(2)}ms`);
        
        // Performance assessment
        console.log(`\n🎯 Performance Assessment:`);
        const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
        const avgResponseTime = this.results.averageResponseTime;
        const requestsPerSecond = this.results.requestsPerSecond;
        
        let grade = 'Poor';
        let color = '🔴';
        
        if (successRate >= 99 && avgResponseTime <= 200 && requestsPerSecond >= 50) {
            grade = 'Excellent';
            color = '🟢';
        } else if (successRate >= 95 && avgResponseTime <= 500 && requestsPerSecond >= 20) {
            grade = 'Good';
            color = '🟡';
        }
        
        console.log(`  Overall Grade: ${color} ${grade}`);
        
        if (this.results.errors.length > 0) {
            console.log(`\n❌ Common Errors:`);
            const errorCounts = {};
            this.results.errors.forEach(error => {
                errorCounts[error] = (errorCounts[error] || 0) + 1;
            });
            
            Object.entries(errorCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .forEach(([error, count]) => {
                    console.log(`  ${error}: ${count} occurrences`);
                });
        }
        
        console.log(`\n💡 Recommendations:`);
        if (successRate < 95) {
            console.log('  • Investigate and fix errors causing request failures');
        }
        if (avgResponseTime > 500) {
            console.log('  • Optimize slow endpoints and database queries');
            console.log('  • Consider implementing caching strategies');
        }
        if (requestsPerSecond < 20) {
            console.log('  • Review server configuration and scaling options');
            console.log('  • Consider implementing connection pooling');
        }
        if (grade === 'Excellent') {
            console.log('  • Platform performs excellently under load!');
            console.log('  • Consider testing with higher concurrent users');
        }
        
        console.log('\n✅ Load test completed successfully!');
    }
}

// Run load test if called directly
if (require.main === module) {
    const options = {
        concurrentUsers: process.argv[2] ? parseInt(process.argv[2]) : 50,
        testDuration: process.argv[3] ? parseInt(process.argv[3]) * 1000 : 60000,
        rampUpTime: process.argv[4] ? parseInt(process.argv[4]) * 1000 : 10000
    };
    
    const loadTester = new LoadTester('http://localhost:3000/api', options);
    loadTester.run().catch(console.error);
}

module.exports = LoadTester;
