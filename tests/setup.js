// Jest setup file for EnigmaCode tests
const mongoose = require('mongoose');

// Setup test environment
beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/enigmacode_test';
    process.env.OBFUSCATION_API_KEY = 'test-obfuscation-key';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
    process.env.LOADER_INTEGRITY_KEY = 'test-loader-key';
    
    // Suppress console output during tests
    if (process.env.SUPPRESS_TEST_LOGS === 'true') {
        console.log = jest.fn();
        console.error = jest.fn();
        console.warn = jest.fn();
    }
});

// Cleanup after all tests
afterAll(async () => {
    // Close any remaining database connections
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});

// Global test timeout
jest.setTimeout(30000);

// Mock external services for testing
jest.mock('../backend/services/webhook', () => ({
    sendNotification: jest.fn().mockResolvedValue(true),
    testWebhook: jest.fn().mockResolvedValue(true),
    getWebhookStats: jest.fn().mockReturnValue({
        configured: false,
        rateLimits: {},
        maxRetries: 3,
        retryDelay: 1000
    })
}));

// Mock Discord webhook for tests
process.env.DISCORD_WEBHOOK_URL = '';

// Export test utilities
global.testUtils = {
    createTestUser: async (userData = {}) => {
        const User = require('../backend/models/User');
        const defaultData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'TestPassword123!'
        };
        
        const user = new User({ ...defaultData, ...userData });
        return await user.save();
    },
    
    createTestProject: async (userId, projectData = {}) => {
        const Project = require('../backend/models/Project');
        const defaultData = {
            name: 'Test Project',
            owner: userId,
            files: [{
                filename: 'test.lua',
                originalName: 'test.lua',
                content: 'print("test")',
                size: 12
            }]
        };
        
        const project = new Project({ ...defaultData, ...projectData });
        return await project.save();
    },
    
    createTestKey: async (userId, projectId, keyData = {}) => {
        const Key = require('../backend/models/Key');
        const defaultData = {
            project: projectId,
            owner: userId,
            type: 'permanent'
        };
        
        const key = new Key({ ...defaultData, ...keyData });
        return await key.save();
    }
};
