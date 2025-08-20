const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all API keys for user
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const apiKeys = user.apiKeys.map(key => ({
      keyId: key.keyId,
      name: key.name,
      key: key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 4), // Masked
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive
    }));

    res.json({ apiKeys });
  } catch (error) {
    console.error('API keys fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create new API key
router.post('/keys', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    const user = await User.findById(req.user._id);
    
    // Check if user already has 5 API keys (limit)
    if (user.apiKeys.length >= 5) {
      return res.status(400).json({ error: 'Maximum of 5 API keys allowed' });
    }

    const { keyId, key } = user.generateApiKey(name.trim());
    await user.save();

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        keyId,
        name,
        key, // Return full key only on creation
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('API key creation error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Revoke API key
router.delete('/keys/:keyId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const keyIndex = user.apiKeys.findIndex(k => k.keyId === req.params.keyId);

    if (keyIndex === -1) {
      return res.status(404).json({ error: 'API key not found' });
    }

    user.apiKeys.splice(keyIndex, 1);
    await user.save();

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('API key revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Toggle API key status
router.put('/keys/:keyId/toggle', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const keyIndex = user.apiKeys.findIndex(k => k.keyId === req.params.keyId);

    if (keyIndex === -1) {
      return res.status(404).json({ error: 'API key not found' });
    }

    user.apiKeys[keyIndex].isActive = !user.apiKeys[keyIndex].isActive;
    await user.save();

    res.json({
      message: `API key ${user.apiKeys[keyIndex].isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: user.apiKeys[keyIndex].isActive
    });
  } catch (error) {
    console.error('API key toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle API key status' });
  }
});

// Get API documentation
router.get('/docs', (req, res) => {
  const documentation = {
    title: 'EnigmaCode API Documentation',
    version: '1.0.0',
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
    authentication: {
      type: 'API Key',
      header: 'X-API-Key',
      description: 'Include your API key in the X-API-Key header'
    },
    endpoints: {
      projects: {
        'GET /projects': {
          description: 'Get all projects',
          authentication: 'required',
          parameters: {},
          response: {
            projects: 'Array of project objects'
          }
        },
        'POST /projects': {
          description: 'Create new project',
          authentication: 'required',
          parameters: {
            name: 'string (required)',
            description: 'string (optional)',
            file: 'file (required)'
          },
          response: {
            message: 'string',
            project: 'object'
          }
        },
        'GET /projects/:projectId': {
          description: 'Get specific project',
          authentication: 'required',
          parameters: {
            projectId: 'string (path parameter)'
          },
          response: {
            project: 'object'
          }
        }
      },
      keys: {
        'GET /keys': {
          description: 'Get all keys',
          authentication: 'required',
          parameters: {
            page: 'number (optional)',
            limit: 'number (optional)',
            status: 'string (optional)',
            projectId: 'string (optional)'
          },
          response: {
            keys: 'Array of key objects',
            pagination: 'object'
          }
        },
        'POST /keys': {
          description: 'Create new key',
          authentication: 'required',
          parameters: {
            projectId: 'string (required)',
            type: 'string (optional)',
            linkedUserId: 'string (optional)'
          },
          response: {
            message: 'string',
            key: 'object'
          }
        },
        'PUT /keys/:keyId': {
          description: 'Update key',
          authentication: 'required',
          parameters: {
            keyId: 'string (path parameter)',
            status: 'string (optional)',
            linkedUserId: 'string (optional)'
          },
          response: {
            message: 'string',
            key: 'object'
          }
        }
      },
      loader: {
        'GET /loader/validate': {
          description: 'Validate key and get obfuscated code',
          authentication: 'none',
          headers: {
            'X-Project-ID': 'string (required)',
            'X-User-Key': 'string (required)',
            'X-User-ID': 'string (optional)'
          },
          response: {
            valid: 'boolean',
            code: 'string (if valid)',
            keyInfo: 'object (if valid)'
          }
        }
      }
    },
    examples: {
      javascript: {
        'Create Project': `
const response = await fetch('${process.env.API_BASE_URL || 'http://localhost:3000/api'}/projects', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Project',
    description: 'Project description'
  })
});

const data = await response.json();
console.log(data);`,
        'Validate Key': `
const response = await fetch('${process.env.API_BASE_URL || 'http://localhost:3000/api'}/loader/validate', {
  headers: {
    'X-Project-ID': 'proj_123abc',
    'X-User-Key': 'ek_456def',
    'X-User-ID': '12345'
  }
});

const data = await response.json();
if (data.valid) {
  console.log('Key is valid, code:', data.code);
} else {
  console.log('Key is invalid:', data.error);
}`
      },
      python: {
        'Create Project': `
import requests

response = requests.post('${process.env.API_BASE_URL || 'http://localhost:3000/api'}/projects', 
  headers={
    'X-API-Key': 'your_api_key_here',
    'Content-Type': 'application/json'
  },
  json={
    'name': 'My Project',
    'description': 'Project description'
  }
)

data = response.json()
print(data)`,
        'Validate Key': `
import requests

response = requests.get('${process.env.API_BASE_URL || 'http://localhost:3000/api'}/loader/validate',
  headers={
    'X-Project-ID': 'proj_123abc',
    'X-User-Key': 'ek_456def',
    'X-User-ID': '12345'
  }
)

data = response.json()
if data['valid']:
  print('Key is valid, code:', data['code'])
else:
  print('Key is invalid:', data['error'])`
      }
    }
  };

  res.json(documentation);
});

module.exports = router;
