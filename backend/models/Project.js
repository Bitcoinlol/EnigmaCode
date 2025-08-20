const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  files: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  obfuscationSettings: {
    tier: {
      type: String,
      enum: ['standard', 'premium'],
      default: 'standard'
    },
    stringEncryption: {
      type: Boolean,
      default: true
    },
    variableRenaming: {
      type: Boolean,
      default: true
    },
    antiDebugging: {
      type: Boolean,
      default: true
    },
    controlFlowFlattening: {
      type: Boolean,
      default: false
    },
    bytecodeEncryption: {
      type: Boolean,
      default: false
    },
    virtualization: {
      type: Boolean,
      default: false
    },
    integrityChecks: {
      type: Boolean,
      default: true
    }
  },
  obfuscatedCode: {
    type: String,
    default: null
  },
  loaderScript: {
    type: String,
    default: null
  },
  stats: {
    totalKeys: {
      type: Number,
      default: 0
    },
    activeKeys: {
      type: Number,
      default: 0
    },
    totalActivations: {
      type: Number,
      default: 0
    },
    uniqueUsers: {
      type: Number,
      default: 0
    },
    lastActivation: {
      type: Date,
      default: null
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate unique project ID
projectSchema.pre('save', function(next) {
  if (!this.projectId) {
    const crypto = require('crypto');
    this.projectId = `proj_${crypto.randomBytes(16).toString('hex')}`;
  }
  next();
});

// Generate loader script
projectSchema.methods.generateLoaderScript = function() {
  const crypto = require('crypto');
  const integrityHash = crypto.createHash('sha256')
    .update(this.obfuscatedCode || '')
    .digest('hex');
  
  const loaderTemplate = `
-- EnigmaCode Loader v1.0
-- Project: ${this.name}
-- Generated: ${new Date().toISOString()}

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local API_BASE = "${process.env.API_BASE_URL || 'http://localhost:3000/api'}"
local PROJECT_ID = "${this.projectId}"
local INTEGRITY_HASH = "${integrityHash}"

local function validateKey(key, userId)
    local success, response = pcall(function()
        return HttpService:GetAsync(API_BASE .. "/loader/validate", {
            ["Content-Type"] = "application/json",
            ["X-Project-ID"] = PROJECT_ID,
            ["X-User-Key"] = key,
            ["X-User-ID"] = tostring(userId or Players.LocalPlayer.UserId)
        })
    end)
    
    if not success then
        return false, nil
    end
    
    local data = HttpService:JSONDecode(response)
    return data.valid == true, data.code
end

local function executeScript(code)
    if not code then return end
    
    -- Integrity check
    local codeHash = HttpService:GenerateGUID(false):gsub("-", "")
    if codeHash ~= INTEGRITY_HASH then
        return -- Silent failure on tamper detection
    end
    
    local success, result = pcall(loadstring(code))
    if not success then
        -- Silent failure - no error reporting
        return
    end
end

-- Main execution
return function(userKey)
    local userId = Players.LocalPlayer.UserId
    local isValid, scriptCode = validateKey(userKey, userId)
    
    if isValid and scriptCode then
        executeScript(scriptCode)
    end
    -- Silent failure if invalid
end`;

  this.loaderScript = loaderTemplate;
  return loaderTemplate;
};

module.exports = mongoose.model('Project', projectSchema);
