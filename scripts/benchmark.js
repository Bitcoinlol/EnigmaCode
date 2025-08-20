// Benchmark Script for EnigmaCode Platform
const axios = require('axios');
const { performance } = require('perf_hooks');

class EnigmaCodeBenchmark {
    constructor(baseUrl = 'http://localhost:3000/api') {
        this.baseUrl = baseUrl;
        this.authToken = null;
        this.results = {
            auth: {},
            projects: {},
            keys: {},
            loader: {},
            overall: {}
        };
    }

    async run() {
        console.log('🚀 Starting EnigmaCode Platform Benchmark...\n');
        
        try {
            await this.benchmarkAuth();
            await this.benchmarkProjects();
            await this.benchmarkKeys();
            await this.benchmarkLoader();
            
            this.generateReport();
        } catch (error) {
            console.error('❌ Benchmark failed:', error.message);
        }
    }

    async benchmarkAuth() {
        console.log('📝 Benchmarking Authentication...');
        
        // Registration benchmark
        const regStart = performance.now();
        const registerResponse = await axios.post(`${this.baseUrl}/auth/register`, {
            username: `benchuser_${Date.now()}`,
            email: `bench_${Date.now()}@example.com`,
            password: 'BenchPassword123!'
        });
        const regEnd = performance.now();
        
        this.results.auth.registration = regEnd - regStart;
        this.authToken = registerResponse.data.token;
        
        // Login benchmark
        const loginStart = performance.now();
        await axios.post(`${this.baseUrl}/auth/login`, {
            username: registerResponse.data.user.username,
            password: 'BenchPassword123!'
        });
        const loginEnd = performance.now();
        
        this.results.auth.login = loginEnd - loginStart;
        
        console.log(`  ✅ Registration: ${this.results.auth.registration.toFixed(2)}ms`);
        console.log(`  ✅ Login: ${this.results.auth.login.toFixed(2)}ms\n`);
    }

    async benchmarkProjects() {
        console.log('📁 Benchmarking Projects...');
        
        // Project creation benchmark
        const createStart = performance.now();
        const FormData = require('form-data');
        const form = new FormData();
        form.append('name', 'Benchmark Project');
        form.append('description', 'Performance test project');
        form.append('file', Buffer.from('print("Benchmark test")'), 'benchmark.lua');
        
        const projectResponse = await axios.post(`${this.baseUrl}/projects`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        const createEnd = performance.now();
        
        this.results.projects.creation = createEnd - createStart;
        this.testProject = projectResponse.data.project;
        
        // Project listing benchmark
        const listStart = performance.now();
        await axios.get(`${this.baseUrl}/projects`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        const listEnd = performance.now();
        
        this.results.projects.listing = listEnd - listStart;
        
        // Obfuscation benchmark
        const obfStart = performance.now();
        await axios.post(`${this.baseUrl}/projects/${this.testProject.projectId}/obfuscate`, 
            { tier: 'standard' },
            { headers: { 'Authorization': `Bearer ${this.authToken}` } }
        );
        const obfEnd = performance.now();
        
        this.results.projects.obfuscation = obfEnd - obfStart;
        
        console.log(`  ✅ Creation: ${this.results.projects.creation.toFixed(2)}ms`);
        console.log(`  ✅ Listing: ${this.results.projects.listing.toFixed(2)}ms`);
        console.log(`  ✅ Obfuscation: ${this.results.projects.obfuscation.toFixed(2)}ms\n`);
    }

    async benchmarkKeys() {
        console.log('🔑 Benchmarking Keys...');
        
        // Key creation benchmark
        const createStart = performance.now();
        const keyResponse = await axios.post(`${this.baseUrl}/keys`, {
            projectId: this.testProject.projectId,
            type: 'permanent'
        }, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        const createEnd = performance.now();
        
        this.results.keys.creation = createEnd - createStart;
        this.testKey = keyResponse.data.key;
        
        // Key listing benchmark
        const listStart = performance.now();
        await axios.get(`${this.baseUrl}/keys`, {
            headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
        const listEnd = performance.now();
        
        this.results.keys.listing = listEnd - listStart;
        
        console.log(`  ✅ Creation: ${this.results.keys.creation.toFixed(2)}ms`);
        console.log(`  ✅ Listing: ${this.results.keys.listing.toFixed(2)}ms\n`);
    }

    async benchmarkLoader() {
        console.log('🔄 Benchmarking Loader Validation...');
        
        // Single validation benchmark
        const singleStart = performance.now();
        await axios.get(`${this.baseUrl}/loader/validate`, {
            headers: {
                'X-Project-ID': this.testProject.projectId,
                'X-User-Key': this.testKey.keyString,
                'X-User-ID': '12345'
            }
        });
        const singleEnd = performance.now();
        
        this.results.loader.singleValidation = singleEnd - singleStart;
        
        // Concurrent validation benchmark
        const concurrentStart = performance.now();
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
            promises.push(
                axios.get(`${this.baseUrl}/loader/validate`, {
                    headers: {
                        'X-Project-ID': this.testProject.projectId,
                        'X-User-Key': this.testKey.keyString,
                        'X-User-ID': `user${i}`
                    }
                })
            );
        }
        
        await Promise.all(promises);
        const concurrentEnd = performance.now();
        
        this.results.loader.concurrentValidation = concurrentEnd - concurrentStart;
        this.results.loader.avgConcurrentValidation = this.results.loader.concurrentValidation / 10;
        
        console.log(`  ✅ Single Validation: ${this.results.loader.singleValidation.toFixed(2)}ms`);
        console.log(`  ✅ 10 Concurrent Validations: ${this.results.loader.concurrentValidation.toFixed(2)}ms`);
        console.log(`  ✅ Average per Validation: ${this.results.loader.avgConcurrentValidation.toFixed(2)}ms\n`);
    }

    generateReport() {
        console.log('📊 BENCHMARK RESULTS');
        console.log('='.repeat(50));
        
        // Performance grades
        const grades = {
            excellent: '🟢 Excellent',
            good: '🟡 Good',
            poor: '🔴 Needs Improvement'
        };
        
        const getGrade = (time, excellentThreshold, goodThreshold) => {
            if (time <= excellentThreshold) return grades.excellent;
            if (time <= goodThreshold) return grades.good;
            return grades.poor;
        };
        
        console.log('\n🔐 Authentication Performance:');
        console.log(`  Registration: ${this.results.auth.registration.toFixed(2)}ms ${getGrade(this.results.auth.registration, 500, 1000)}`);
        console.log(`  Login: ${this.results.auth.login.toFixed(2)}ms ${getGrade(this.results.auth.login, 300, 600)}`);
        
        console.log('\n📁 Project Performance:');
        console.log(`  Creation: ${this.results.projects.creation.toFixed(2)}ms ${getGrade(this.results.projects.creation, 800, 1500)}`);
        console.log(`  Listing: ${this.results.projects.listing.toFixed(2)}ms ${getGrade(this.results.projects.listing, 200, 500)}`);
        console.log(`  Obfuscation: ${this.results.projects.obfuscation.toFixed(2)}ms ${getGrade(this.results.projects.obfuscation, 1000, 3000)}`);
        
        console.log('\n🔑 Key Performance:');
        console.log(`  Creation: ${this.results.keys.creation.toFixed(2)}ms ${getGrade(this.results.keys.creation, 300, 600)}`);
        console.log(`  Listing: ${this.results.keys.listing.toFixed(2)}ms ${getGrade(this.results.keys.listing, 200, 500)}`);
        
        console.log('\n🔄 Loader Performance:');
        console.log(`  Single Validation: ${this.results.loader.singleValidation.toFixed(2)}ms ${getGrade(this.results.loader.singleValidation, 100, 300)}`);
        console.log(`  Concurrent Avg: ${this.results.loader.avgConcurrentValidation.toFixed(2)}ms ${getGrade(this.results.loader.avgConcurrentValidation, 150, 400)}`);
        
        // Overall assessment
        const allTimes = [
            this.results.auth.registration,
            this.results.auth.login,
            this.results.projects.creation,
            this.results.projects.listing,
            this.results.projects.obfuscation,
            this.results.keys.creation,
            this.results.keys.listing,
            this.results.loader.singleValidation,
            this.results.loader.avgConcurrentValidation
        ];
        
        const avgTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
        
        console.log('\n🎯 Overall Assessment:');
        console.log(`  Average Response Time: ${avgTime.toFixed(2)}ms`);
        console.log(`  Performance Grade: ${getGrade(avgTime, 400, 800)}`);
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        if (this.results.projects.obfuscation > 3000) {
            console.log('  • Consider optimizing obfuscation algorithms');
        }
        if (this.results.loader.singleValidation > 300) {
            console.log('  • Consider adding database indexes for key lookups');
        }
        if (avgTime > 800) {
            console.log('  • Consider implementing caching for frequently accessed data');
            console.log('  • Review database query optimization');
        }
        if (avgTime <= 400) {
            console.log('  • Excellent performance! Platform is well optimized.');
        }
        
        console.log('\n✅ Benchmark completed successfully!');
    }
}

// Run benchmark if called directly
if (require.main === module) {
    const benchmark = new EnigmaCodeBenchmark();
    benchmark.run().catch(console.error);
}

module.exports = EnigmaCodeBenchmark;
