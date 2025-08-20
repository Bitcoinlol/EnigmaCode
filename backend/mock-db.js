// Temporary in-memory database for testing without MongoDB
class MockDatabase {
    constructor() {
        this.users = new Map();
        this.projects = new Map();
        this.keys = new Map();
        this.analytics = [];
    }

    // User operations
    async createUser(userData) {
        const user = {
            _id: Date.now().toString(),
            username: userData.username,
            email: userData.email,
            password: userData.password, // In real app, this would be hashed
            role: 'user',
            subscription: { tier: 'free' },
            stats: { totalProjects: 0, totalKeys: 0 },
            settings: {},
            isActive: true,
            isBanned: false,
            createdAt: new Date(),
            lastLogin: new Date()
        };
        
        this.users.set(user._id, user);
        return user;
    }

    async findUserByEmail(email) {
        for (let user of this.users.values()) {
            if (user.email === email) return user;
        }
        return null;
    }

    async findUserByUsername(username) {
        for (let user of this.users.values()) {
            if (user.username === username) return user;
        }
        return null;
    }

    async findUserById(id) {
        return this.users.get(id) || null;
    }

    // Analytics operations
    async logEvent(eventType, userId, projectId, keyId, metadata) {
        const event = {
            _id: Date.now().toString(),
            eventType,
            userId,
            projectId,
            keyId,
            metadata: metadata || {},
            timestamp: new Date()
        };
        
        this.analytics.push(event);
        return event;
    }
}

// Export singleton instance
module.exports = new MockDatabase();
