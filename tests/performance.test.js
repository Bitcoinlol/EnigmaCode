// Performance and Load Testing for EnigmaCode Platform
const { performance } = require('perf_hooks');
const mongoose = require('mongoose');
const User = require('../backend/models/User');
const Project = require('../backend/models/Project');
const Key = require('../backend/models/Key');
const Analytics = require('../backend/models/Analytics');
const obfuscator = require('../obfuscation-engine/obfuscator');
const LoaderGenerator = require('../client-loader/loader-generator');

describe('Performance Tests', () => {
    beforeAll(async () => {
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/enigmacode_perf_test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Project.deleteMany({});
        await Key.deleteMany({});
        await Analytics.deleteMany({});
    });

    describe('Database Performance', () => {
        test('User creation should be fast', async () => {
            const startTime = performance.now();
            
            const promises = [];
            for (let i = 0; i < 100; i++) {
                const user = new User({
                    username: `user${i}`,
                    email: `user${i}@example.com`,
                    password: 'TestPassword123!'
                });
                promises.push(user.save());
            }
            
            await Promise.all(promises);
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            console.log(`Created 100 users in ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });

        test('Project queries should be optimized', async () => {
            // Create test data
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            });
            await user.save();

            const projects = [];
            for (let i = 0; i < 50; i++) {
                projects.push(new Project({
                    name: `Project ${i}`,
                    owner: user._id,
                    files: [{
                        filename: `file${i}.lua`,
                        originalName: `file${i}.lua`,
                        content: `print("Project ${i}")`,
                        size: 20
                    }]
                }));
            }
            await Project.insertMany(projects);

            // Test query performance
            const startTime = performance.now();
            const userProjects = await Project.find({ owner: user._id })
                .select('name projectId createdAt stats')
                .sort({ createdAt: -1 })
                .limit(20);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Queried 20 projects from 50 in ${duration.toFixed(2)}ms`);
            
            expect(userProjects).toHaveLength(20);
            expect(duration).toBeLessThan(100); // Should complete in under 100ms
        });

        test('Key validation should be fast', async () => {
            // Create test data
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            });
            await user.save();

            const project = new Project({
                name: 'Test Project',
                owner: user._id,
                files: [{
                    filename: 'test.lua',
                    originalName: 'test.lua',
                    content: 'print("test")',
                    size: 12
                }],
                obfuscatedCode: 'obfuscated_code_here'
            });
            await project.save();

            const keys = [];
            for (let i = 0; i < 100; i++) {
                keys.push(new Key({
                    project: project._id,
                    owner: user._id,
                    type: 'permanent'
                }));
            }
            await Key.insertMany(keys);

            // Test key lookup performance
            const testKey = keys[50];
            const startTime = performance.now();
            
            const foundKey = await Key.findOne({
                keyString: testKey.keyString,
                status: 'active'
            }).populate('project', 'obfuscatedCode');
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            console.log(`Key lookup took ${duration.toFixed(2)}ms`);
            expect(foundKey).toBeTruthy();
            expect(duration).toBeLessThan(50); // Should complete in under 50ms
        });

        test('Analytics aggregation should be efficient', async () => {
            // Create test analytics data
            const user = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            });
            await user.save();

            const analyticsData = [];
            const eventTypes = ['activation', 'error', 'registration', 'login'];
            
            for (let i = 0; i < 1000; i++) {
                analyticsData.push(new Analytics({
                    eventType: eventTypes[i % eventTypes.length],
                    userId: user._id,
                    timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random time in last 30 days
                    metadata: {
                        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
                        userAgent: 'Test Agent'
                    }
                }));
            }
            await Analytics.insertMany(analyticsData);

            // Test aggregation performance
            const startTime = performance.now();
            
            const stats = await Analytics.aggregate([
                {
                    $match: {
                        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: '$eventType',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            console.log(`Analytics aggregation took ${duration.toFixed(2)}ms`);
            expect(stats).toBeTruthy();
            expect(duration).toBeLessThan(200); // Should complete in under 200ms
        });
    });

    describe('Obfuscation Performance', () => {
        test('Standard obfuscation should be fast', async () => {
            const luaCode = `
                local function fibonacci(n)
                    if n <= 1 then
                        return n
                    else
                        return fibonacci(n-1) + fibonacci(n-2)
                    end
                end
                
                for i = 1, 10 do
                    print("Fibonacci of " .. i .. " is " .. fibonacci(i))
                end
                
                local players = game:GetService("Players")
                local localPlayer = players.LocalPlayer
                
                print("Hello, " .. localPlayer.Name .. "!")
            `;

            const startTime = performance.now();
            const obfuscated = obfuscator.obfuscate(luaCode, 'standard');
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Standard obfuscation took ${duration.toFixed(2)}ms`);
            
            expect(obfuscated).toBeTruthy();
            expect(obfuscated.length).toBeGreaterThan(luaCode.length);
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
        });

        test('Premium obfuscation should complete within reasonable time', async () => {
            const luaCode = `
                local HttpService = game:GetService("HttpService")
                local Players = game:GetService("Players")
                
                local function makeRequest(url, data)
                    local success, result = pcall(function()
                        return HttpService:PostAsync(url, HttpService:JSONEncode(data))
                    end)
                    
                    if success then
                        return HttpService:JSONDecode(result)
                    else
                        warn("Request failed: " .. tostring(result))
                        return nil
                    end
                end
                
                local player = Players.LocalPlayer
                local data = {
                    userId = player.UserId,
                    username = player.Name,
                    timestamp = tick()
                }
                
                local response = makeRequest("https://api.example.com/validate", data)
                if response and response.valid then
                    print("Validation successful!")
                else
                    print("Validation failed!")
                end
            `;

            const startTime = performance.now();
            const obfuscated = obfuscator.obfuscate(luaCode, 'premium');
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Premium obfuscation took ${duration.toFixed(2)}ms`);
            
            expect(obfuscated).toBeTruthy();
            expect(obfuscated.length).toBeGreaterThan(luaCode.length);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
        });

        test('Batch obfuscation should be efficient', async () => {
            const luaCodes = [];
            for (let i = 0; i < 10; i++) {
                luaCodes.push(`
                    local function test${i}()
                        print("Function ${i}")
                        return ${i} * 2
                    end
                    test${i}()
                `);
            }

            const startTime = performance.now();
            const promises = luaCodes.map(code => 
                Promise.resolve(obfuscator.obfuscate(code, 'standard'))
            );
            const results = await Promise.all(promises);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Batch obfuscation of 10 files took ${duration.toFixed(2)}ms`);
            
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toBeTruthy();
            });
            expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
        });
    });

    describe('Loader Generation Performance', () => {
        test('Loader generation should be fast', async () => {
            const mockProject = {
                projectId: 'test-project-123',
                name: 'Test Project',
                obfuscatedCode: 'print("obfuscated")',
                obfuscationSettings: {
                    tier: 'standard',
                    integrityChecks: true
                },
                createdAt: new Date()
            };

            const startTime = performance.now();
            const result = LoaderGenerator.generate(mockProject);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Loader generation took ${duration.toFixed(2)}ms`);
            
            expect(result.loader).toBeTruthy();
            expect(result.config).toBeTruthy();
            expect(result.metadata).toBeTruthy();
            expect(duration).toBeLessThan(500); // Should complete in under 500ms
        });

        test('Premium loader generation should be efficient', async () => {
            const mockProject = {
                projectId: 'test-project-premium',
                name: 'Premium Test Project',
                obfuscatedCode: 'print("premium obfuscated")',
                obfuscationSettings: {
                    tier: 'premium',
                    integrityChecks: true
                },
                createdAt: new Date()
            };

            const startTime = performance.now();
            const result = LoaderGenerator.generate(mockProject, {
                obfuscateLoader: true
            });
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`Premium loader generation took ${duration.toFixed(2)}ms`);
            
            expect(result.loader).toBeTruthy();
            expect(result.loader.length).toBeGreaterThan(1000); // Should be substantial
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
        });
    });

    describe('Memory Usage Tests', () => {
        test('Should not leak memory during intensive operations', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Perform memory-intensive operations
            for (let i = 0; i < 100; i++) {
                const user = new User({
                    username: `memtest${i}`,
                    email: `memtest${i}@example.com`,
                    password: 'TestPassword123!'
                });
                await user.save();
                
                // Obfuscate some code
                const code = `print("Memory test ${i}")`;
                obfuscator.obfuscate(code, 'standard');
                
                // Generate loader
                const mockProject = {
                    projectId: `memtest-${i}`,
                    name: `Memory Test ${i}`,
                    obfuscatedCode: code,
                    obfuscationSettings: { tier: 'standard' }
                };
                LoaderGenerator.generate(mockProject);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
            
            console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
            
            // Memory increase should be reasonable (less than 50MB for this test)
            expect(memoryIncreaseMB).toBeLessThan(50);
        });
    });

    describe('Concurrent Operations', () => {
        test('Should handle concurrent user registrations', async () => {
            const startTime = performance.now();
            
            const promises = [];
            for (let i = 0; i < 50; i++) {
                const promise = (async () => {
                    const user = new User({
                        username: `concurrent${i}`,
                        email: `concurrent${i}@example.com`,
                        password: 'TestPassword123!'
                    });
                    return await user.save();
                })();
                promises.push(promise);
            }
            
            const results = await Promise.all(promises);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`50 concurrent user registrations took ${duration.toFixed(2)}ms`);
            
            expect(results).toHaveLength(50);
            expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
        });

        test('Should handle concurrent key validations', async () => {
            // Setup test data
            const user = new User({
                username: 'concurrenttest',
                email: 'concurrent@example.com',
                password: 'TestPassword123!'
            });
            await user.save();

            const project = new Project({
                name: 'Concurrent Test Project',
                owner: user._id,
                files: [{
                    filename: 'test.lua',
                    originalName: 'test.lua',
                    content: 'print("concurrent test")',
                    size: 25
                }],
                obfuscatedCode: 'obfuscated_concurrent_test'
            });
            await project.save();

            const key = new Key({
                project: project._id,
                owner: user._id,
                type: 'permanent'
            });
            await key.save();

            // Perform concurrent validations
            const startTime = performance.now();
            
            const promises = [];
            for (let i = 0; i < 100; i++) {
                const promise = Key.findOne({
                    keyString: key.keyString,
                    status: 'active'
                }).populate('project', 'obfuscatedCode');
                promises.push(promise);
            }
            
            const results = await Promise.all(promises);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            console.log(`100 concurrent key validations took ${duration.toFixed(2)}ms`);
            
            expect(results).toHaveLength(100);
            results.forEach(result => {
                expect(result).toBeTruthy();
                expect(result.keyString).toBe(key.keyString);
            });
            expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
        });
    });
});
