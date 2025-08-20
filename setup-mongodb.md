# MongoDB Setup Options

## Option 1: MongoDB Atlas (Cloud - Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Sign up for free account
3. Create a new cluster (free tier)
4. Get connection string
5. Update `.env` file with connection string

## Option 2: Local MongoDB

### Windows:
```bash
# Install MongoDB Community Server
# Download from: https://www.mongodb.com/try/download/community

# Start MongoDB service
net start MongoDB

# Or run manually:
mongod --dbpath C:\data\db
```

### Docker (Easiest):
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Quick Setup with Docker

Run this command to start MongoDB locally:
```bash
docker run -d -p 27017:27017 --name enigmacode-mongodb -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest
```

Then update your `.env` file:
```
MONGODB_URI=mongodb://admin:password@localhost:27017/enigmacode?authSource=admin
```
