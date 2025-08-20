// API Integration Tests for EnigmaCode Platform
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../backend/server');
const User = require('../backend/models/User');
const Project = require('../backend/models/Project');
const Key = require('../backend/models/Key');

describe('EnigmaCode API Tests', () => {
    let authToken;
    let testUser;
    let testProject;
    let testKey;

    beforeAll(async () => {
        // Connect to test database
        const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/enigmacode_test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterAll(async () => {
        // Clean up test database
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clean collections before each test
        await User.deleteMany({});
        await Project.deleteMany({});
        await Key.deleteMany({});
    });

    describe('Authentication', () => {
        test('POST /api/auth/register - should register new user', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user.username).toBe(userData.username);
            expect(response.body.user.email).toBe(userData.email);
            expect(response.body.user.password).toBeUndefined();

            authToken = response.body.token;
            testUser = response.body.user;
        });

        test('POST /api/auth/register - should reject duplicate email', async () => {
            const userData = {
                username: 'testuser1',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            // Create first user
            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            // Try to create second user with same email
            const duplicateUser = {
                username: 'testuser2',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            await request(app)
                .post('/api/auth/register')
                .send(duplicateUser)
                .expect(400);
        });

        test('POST /api/auth/login - should login with valid credentials', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            // Register user first
            await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            // Login
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    username: userData.username,
                    password: userData.password
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
        });

        test('POST /api/auth/login - should reject invalid credentials', async () => {
            await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'wrongpassword'
                })
                .expect(401);
        });
    });

    describe('Projects', () => {
        beforeEach(async () => {
            // Create authenticated user for project tests
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            authToken = response.body.token;
            testUser = response.body.user;
        });

        test('POST /api/projects - should create new project', async () => {
            const projectData = {
                name: 'Test Project',
                description: 'A test project'
            };

            const luaCode = 'print("Hello, World!")';

            const response = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', projectData.name)
                .field('description', projectData.description)
                .attach('file', Buffer.from(luaCode), 'test.lua')
                .expect(201);

            expect(response.body.message).toBe('Project created successfully');
            expect(response.body.project.name).toBe(projectData.name);
            expect(response.body.project.projectId).toBeDefined();

            testProject = response.body.project;
        });

        test('GET /api/projects - should list user projects', async () => {
            // Create a project first
            await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', 'Test Project')
                .attach('file', Buffer.from('print("test")'), 'test.lua')
                .expect(201);

            const response = await request(app)
                .get('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.projects).toHaveLength(1);
            expect(response.body.data.projects[0].name).toBe('Test Project');
        });

        test('POST /api/projects/:projectId/obfuscate - should obfuscate project', async () => {
            // Create project first
            const projectResponse = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', 'Test Project')
                .attach('file', Buffer.from('print("Hello, World!")'), 'test.lua')
                .expect(201);

            const projectId = projectResponse.body.project.projectId;

            const response = await request(app)
                .post(`/api/projects/${projectId}/obfuscate`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ tier: 'standard' })
                .expect(200);

            expect(response.body.message).toBe('Project obfuscated successfully');
            expect(response.body.obfuscatedCode).toBeDefined();
        });
    });

    describe('Keys', () => {
        beforeEach(async () => {
            // Setup user and project for key tests
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const userResponse = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            authToken = userResponse.body.token;

            const projectResponse = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', 'Test Project')
                .attach('file', Buffer.from('print("test")'), 'test.lua')
                .expect(201);

            testProject = projectResponse.body.project;
        });

        test('POST /api/keys - should create new key', async () => {
            const keyData = {
                projectId: testProject.projectId,
                type: 'permanent'
            };

            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send(keyData)
                .expect(201);

            expect(response.body.message).toBe('Key created successfully');
            expect(response.body.key.keyString).toBeDefined();
            expect(response.body.key.type).toBe('permanent');

            testKey = response.body.key;
        });

        test('GET /api/keys - should list user keys', async () => {
            // Create a key first
            await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: testProject.projectId,
                    type: 'permanent'
                })
                .expect(201);

            const response = await request(app)
                .get('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.keys).toHaveLength(1);
        });

        test('POST /api/keys/:keyId/ban - should ban key', async () => {
            // Create key first
            const keyResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: testProject.projectId,
                    type: 'permanent'
                })
                .expect(201);

            const keyId = keyResponse.body.key.keyId;

            const response = await request(app)
                .post(`/api/keys/${keyId}/ban`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ reason: 'Test ban' })
                .expect(200);

            expect(response.body.message).toBe('Key banned successfully');
            expect(response.body.key.status).toBe('banned');
        });
    });

    describe('Loader Validation', () => {
        beforeEach(async () => {
            // Setup complete test environment
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const userResponse = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            authToken = userResponse.body.token;

            const projectResponse = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', 'Test Project')
                .attach('file', Buffer.from('print("Hello, World!")'), 'test.lua')
                .expect(201);

            testProject = projectResponse.body.project;

            // Obfuscate the project
            await request(app)
                .post(`/api/projects/${testProject.projectId}/obfuscate`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ tier: 'standard' })
                .expect(200);

            const keyResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: testProject.projectId,
                    type: 'permanent'
                })
                .expect(201);

            testKey = keyResponse.body.key;
        });

        test('GET /api/loader/validate - should validate key and return code', async () => {
            const response = await request(app)
                .get('/api/loader/validate')
                .set('X-Project-ID', testProject.projectId)
                .set('X-User-Key', testKey.keyString)
                .set('X-User-ID', '12345')
                .expect(200);

            expect(response.body.valid).toBe(true);
            expect(response.body.code).toBeDefined();
            expect(response.body.keyInfo).toBeDefined();
        });

        test('GET /api/loader/validate - should reject invalid key', async () => {
            const response = await request(app)
                .get('/api/loader/validate')
                .set('X-Project-ID', testProject.projectId)
                .set('X-User-Key', 'invalid-key')
                .set('X-User-ID', '12345')
                .expect(401);

            expect(response.body.valid).toBe(false);
            expect(response.body.error).toBeDefined();
        });

        test('GET /api/loader/validate - should reject banned key', async () => {
            // Ban the key first
            await request(app)
                .post(`/api/keys/${testKey.keyId}/ban`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ reason: 'Test ban' })
                .expect(200);

            const response = await request(app)
                .get('/api/loader/validate')
                .set('X-Project-ID', testProject.projectId)
                .set('X-User-Key', testKey.keyString)
                .set('X-User-ID', '12345')
                .expect(401);

            expect(response.body.valid).toBe(false);
            expect(response.body.error).toBe('Key is banned');
        });
    });

    describe('Performance Tests', () => {
        beforeEach(async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            authToken = response.body.token;
        });

        test('Should handle concurrent project creation', async () => {
            const promises = [];
            const projectCount = 10;

            for (let i = 0; i < projectCount; i++) {
                const promise = request(app)
                    .post('/api/projects')
                    .set('Authorization', `Bearer ${authToken}`)
                    .field('name', `Test Project ${i}`)
                    .attach('file', Buffer.from(`print("Project ${i}")`), `test${i}.lua`);
                
                promises.push(promise);
            }

            const responses = await Promise.all(promises);
            
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.project.projectId).toBeDefined();
            });
        });

        test('Should handle rapid key validation requests', async () => {
            // Create project and key first
            const projectResponse = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .field('name', 'Performance Test Project')
                .attach('file', Buffer.from('print("performance test")'), 'test.lua')
                .expect(201);

            const project = projectResponse.body.project;

            await request(app)
                .post(`/api/projects/${project.projectId}/obfuscate`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ tier: 'standard' })
                .expect(200);

            const keyResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    projectId: project.projectId,
                    type: 'permanent'
                })
                .expect(201);

            const key = keyResponse.body.key;

            // Perform rapid validation requests
            const promises = [];
            const requestCount = 50;

            for (let i = 0; i < requestCount; i++) {
                const promise = request(app)
                    .get('/api/loader/validate')
                    .set('X-Project-ID', project.projectId)
                    .set('X-User-Key', key.keyString)
                    .set('X-User-ID', `user${i}`);
                
                promises.push(promise);
            }

            const startTime = Date.now();
            const responses = await Promise.all(promises);
            const endTime = Date.now();

            const averageResponseTime = (endTime - startTime) / requestCount;

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.valid).toBe(true);
            });

            // Performance assertion - should handle 50 requests in under 5 seconds
            expect(endTime - startTime).toBeLessThan(5000);
            console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
        });
    });

    describe('Error Handling', () => {
        test('Should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);

            expect(response.body.error).toBeDefined();
        });

        test('Should handle missing authorization headers', async () => {
            await request(app)
                .get('/api/projects')
                .expect(401);
        });

        test('Should handle invalid MongoDB ObjectIds', async () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'TestPassword123!'
            };

            const userResponse = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            const token = userResponse.body.token;

            await request(app)
                .get('/api/projects/invalid-id')
                .set('Authorization', `Bearer ${token}`)
                .expect(400);
        });
    });
});
