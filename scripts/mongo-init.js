// MongoDB initialization script for EnigmaCode
db = db.getSiblingDB('enigmacode');

// Create collections with validation
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['username', 'email', 'password'],
            properties: {
                username: {
                    bsonType: 'string',
                    minLength: 3,
                    maxLength: 30
                },
                email: {
                    bsonType: 'string',
                    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                },
                password: {
                    bsonType: 'string',
                    minLength: 60,
                    maxLength: 60
                }
            }
        }
    }
});

db.createCollection('projects');
db.createCollection('keys');
db.createCollection('analytics');

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ 'apiKeys.key': 1 });

db.projects.createIndex({ owner: 1, createdAt: -1 });
db.projects.createIndex({ projectId: 1 }, { unique: true });
db.projects.createIndex({ active: 1 });

db.keys.createIndex({ keyString: 1 }, { unique: true });
db.keys.createIndex({ owner: 1, status: 1 });
db.keys.createIndex({ project: 1 });
db.keys.createIndex({ linkedUserId: 1 });
db.keys.createIndex({ expiresAt: 1 });

db.analytics.createIndex({ eventType: 1, timestamp: -1 });
db.analytics.createIndex({ userId: 1, timestamp: -1 });
db.analytics.createIndex({ projectId: 1, timestamp: -1 });
db.analytics.createIndex({ timestamp: -1 });

print('EnigmaCode database initialized successfully!');
