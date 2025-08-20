const express = require('express');
const multer = require('multer');
const path = require('path');
const Project = require('../models/Project');
const Analytics = require('../models/Analytics');
const { authenticateToken } = require('../middleware/auth');
const obfuscator = require('../../obfuscation-engine/obfuscator');
const webhookService = require('../services/webhook');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.lua')) {
      cb(null, true);
    } else {
      cb(new Error('Only .lua and .txt files are allowed'));
    }
  }
});

// Get all projects for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .select('-obfuscatedCode -loaderScript');

    res.json({ projects });
  } catch (error) {
    console.error('Projects fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get specific project
router.get('/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOne({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Project fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ error: 'Project name and file are required' });
    }

    // Create project
    const project = new Project({
      name,
      description: description || '',
      owner: req.user._id,
      files: [{
        filename: `${Date.now()}_${file.originalname}`,
        originalName: file.originalname,
        content: file.buffer.toString('utf8'),
        size: file.size
      }]
    });

    await project.save();

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalProjects': 1 }
    });

    // Send webhook notification
    await webhookService.sendNotification('project_created', {
      name: project.name,
      owner: req.user.username,
      obfuscationTier: project.obfuscationSettings.tier
    }, req.user._id);

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        projectId: project.projectId,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt
      }
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project settings
router.put('/:projectId', authenticateToken, async (req, res) => {
  try {
    const { name, description, obfuscationSettings } = req.body;

    const project = await Project.findOne({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (obfuscationSettings) {
      project.obfuscationSettings = { ...project.obfuscationSettings, ...obfuscationSettings };
    }

    await project.save();

    res.json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Project update error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Obfuscate project code
router.post('/:projectId/obfuscate', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOne({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.files || project.files.length === 0) {
      return res.status(400).json({ error: 'No files to obfuscate' });
    }

    // Get the main file content
    const mainFile = project.files[0];
    const sourceCode = mainFile.content;

    // Apply obfuscation based on settings
    const obfuscatedCode = await obfuscateCode(sourceCode, project.obfuscationSettings);
    
    project.obfuscatedCode = obfuscatedCode;
    project.loaderScript = project.generateLoaderScript();
    
    await project.save();

    res.json({
      message: 'Code obfuscated successfully',
      obfuscated: true
    });
  } catch (error) {
    console.error('Obfuscation error:', error);
    res.status(500).json({ error: 'Failed to obfuscate code' });
  }
});

// Get loader script
router.get('/:projectId/loader', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOne({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.loaderScript) {
      return res.status(400).json({ error: 'Project not obfuscated yet' });
    }

    res.json({
      loaderScript: project.loaderScript,
      projectId: project.projectId
    });
  } catch (error) {
    console.error('Loader fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch loader script' });
  }
});

// Delete project
router.delete('/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      projectId: req.params.projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalProjects': -1 }
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Project deletion error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Obfuscation function (placeholder - will be enhanced)
async function obfuscateCode(sourceCode, settings) {
  let obfuscated = sourceCode;
  
  if (settings.stringEncryption) {
    // Basic string encryption
    obfuscated = obfuscated.replace(/"([^"]+)"/g, (match, str) => {
      const encoded = Buffer.from(str).toString('base64');
      return `(function() local b='${encoded}' return (b:gsub('.', function(c) return string.char(c:byte() + 1) end)) end)()`;
    });
  }
  
  if (settings.variableRenaming) {
    // Basic variable renaming
    const varMap = new Map();
    let varCounter = 0;
    
    obfuscated = obfuscated.replace(/local\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
      if (!varMap.has(varName)) {
        varMap.set(varName, `_${varCounter.toString(36)}`);
        varCounter++;
      }
      return `local ${varMap.get(varName)}`;
    });
  }
  
  if (settings.antiDebugging) {
    // Add anti-debugging checks
    const antiDebugCode = `
-- Anti-debug protection
if debug and debug.getinfo then
  error("Debug detected", 0)
end
`;
    obfuscated = antiDebugCode + obfuscated;
  }
  
  return obfuscated;
}

module.exports = router;
