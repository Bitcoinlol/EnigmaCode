// Loader Generator - Creates tamper-resistant Lua loaders for each project
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LoaderGenerator {
    constructor() {
        this.templatePath = path.join(__dirname, 'loader-template.lua');
        this.template = null;
        this.loadTemplate();
    }

    loadTemplate() {
        try {
            this.template = fs.readFileSync(this.templatePath, 'utf8');
        } catch (error) {
            throw new Error('Failed to load loader template: ' + error.message);
        }
    }

    generateLoader(project, options = {}) {
        if (!this.template) {
            throw new Error('Loader template not loaded');
        }

        const config = this.generateLoaderConfig(project, options);
        let loader = this.template;

        // Replace template variables
        const replacements = {
            '{{API_BASE_URL}}': config.apiBaseUrl,
            '{{PROJECT_ID}}': config.projectId,
            '{{INTEGRITY_HASH}}': config.integrityHash,
            '{{OBFUSCATION_KEY}}': config.obfuscationKey,
            '{{ANTI_TAMPER_KEY}}': config.antiTamperKey,
            '{{LOADER_HASH}}': config.loaderHash
        };

        for (const [placeholder, value] of Object.entries(replacements)) {
            loader = loader.replace(new RegExp(placeholder, 'g'), value);
        }

        // Apply additional obfuscation to the loader itself
        if (options.obfuscateLoader !== false) {
            loader = this.obfuscateLoader(loader, config);
        }

        // Add project-specific customizations
        loader = this.addProjectCustomizations(loader, project, config);

        // Generate final integrity hash
        const finalHash = this.generateIntegrityHash(loader);
        loader = loader.replace('{{LOADER_HASH}}', finalHash);

        return {
            loader,
            config,
            metadata: {
                projectId: project.projectId,
                generatedAt: new Date().toISOString(),
                version: '2.0',
                features: this.getLoaderFeatures(options)
            }
        };
    }

    generateLoaderConfig(project, options) {
        const obfuscationKey = crypto.randomBytes(32).toString('hex');
        const antiTamperKey = crypto.randomBytes(16).toString('hex');
        const integrityHash = crypto.createHash('sha256')
            .update(project.obfuscatedCode || project.files[0]?.content || '')
            .digest('hex')
            .substring(0, 6); // Use first 6 chars for simplicity

        return {
            apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
            projectId: project.projectId,
            integrityHash,
            obfuscationKey,
            antiTamperKey,
            loaderHash: '000000' // Placeholder, will be calculated later
        };
    }

    obfuscateLoader(loader, config) {
        // Apply basic obfuscation to the loader itself
        let obfuscated = loader;

        // Rename local variables
        const varMap = new Map();
        let varCounter = 0;

        // Find local variable declarations
        const localVarRegex = /local\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        
        while ((match = localVarRegex.exec(loader)) !== null) {
            const varName = match[1];
            if (!this.isReservedWord(varName) && !varMap.has(varName)) {
                varMap.set(varName, `_L${varCounter.toString(36)}`);
                varCounter++;
            }
        }

        // Replace variables
        varMap.forEach((newName, oldName) => {
            const regex = new RegExp(`\\b${oldName}\\b`, 'g');
            obfuscated = obfuscated.replace(regex, newName);
        });

        // Obfuscate string literals
        obfuscated = this.obfuscateStrings(obfuscated);

        // Add dummy code to confuse static analysis
        obfuscated = this.addDummyCode(obfuscated);

        return obfuscated;
    }

    obfuscateStrings(code) {
        const stringRegex = /"([^"\\]|\\.)*"/g;
        
        return code.replace(stringRegex, (match) => {
            const content = match.slice(1, -1); // Remove quotes
            if (content.length < 3 || this.shouldSkipString(content)) {
                return match; // Keep short strings or special strings as-is
            }
            
            // Convert to character codes
            const charCodes = [];
            for (let i = 0; i < content.length; i++) {
                charCodes.push(content.charCodeAt(i));
            }
            
            return `string.char(${charCodes.join(', ')})`;
        });
    }

    shouldSkipString(str) {
        // Skip strings that are likely to be important identifiers or URLs
        const skipPatterns = [
            /^https?:\/\//, // URLs
            /^[A-Z_]+$/, // Constants
            /Service$/, // Roblox services
            /^X-/, // Headers
            /json/i // JSON-related
        ];
        
        return skipPatterns.some(pattern => pattern.test(str));
    }

    addDummyCode(code) {
        const dummyFunctions = [
            `local function _dummy1() local x = math.random(1, 100); return x > 50 end`,
            `local function _dummy2() for i = 1, 10 do math.sin(i) end end`,
            `local function _dummy3() local t = {}; t[1] = "dummy"; return #t end`
        ];

        const dummyCalls = [
            `if _dummy1() then _dummy2() end`,
            `local _temp = _dummy3()`,
            `if math.random() > 0.5 then _dummy1() end`
        ];

        // Insert dummy functions at the beginning
        const functionInsertPoint = code.indexOf('local CONFIG');
        if (functionInsertPoint !== -1) {
            code = code.substring(0, functionInsertPoint) + 
                   dummyFunctions.join('\n') + '\n\n' +
                   code.substring(functionInsertPoint);
        }

        // Insert dummy calls throughout the code
        const lines = code.split('\n');
        const insertPoints = [
            Math.floor(lines.length * 0.25),
            Math.floor(lines.length * 0.5),
            Math.floor(lines.length * 0.75)
        ];

        insertPoints.forEach((point, index) => {
            if (point < lines.length && index < dummyCalls.length) {
                lines.splice(point + index, 0, dummyCalls[index]);
            }
        });

        return lines.join('\n');
    }

    addProjectCustomizations(loader, project, config) {
        let customized = loader;

        // Add project-specific anti-tamper measures
        if (project.obfuscationSettings.integrityChecks) {
            const customCheck = `
-- Project-specific integrity check
local function _project_integrity_check()
    local project_hash = "${project.projectId}".."${config.antiTamperKey}"
    local expected = ${this.generateProjectHash(project)}
    local actual = 0
    for i = 1, #project_hash do
        actual = actual + string.byte(project_hash, i)
    end
    return actual % 999999 == expected
end

if not _project_integrity_check() then
    return false
end`;

            // Insert after the main integrity check
            const insertPoint = customized.indexOf('-- Anti-debugging checks');
            if (insertPoint !== -1) {
                customized = customized.substring(0, insertPoint) + 
                           customCheck + '\n\n' +
                           customized.substring(insertPoint);
            }
        }

        // Add custom validation rules based on project settings
        if (project.obfuscationSettings.tier === 'premium') {
            customized = this.addPremiumFeatures(customized, project, config);
        }

        return customized;
    }

    addPremiumFeatures(loader, project, config) {
        const premiumFeatures = `
-- Premium anti-tamper features
local function _premium_checks()
    -- Check for common exploit tools
    local exploit_signatures = {
        "synapse", "krnl", "oxygen", "sentinel", "protosmasher"
    }
    
    for _, sig in pairs(exploit_signatures) do
        if string.find(string.lower(tostring(_G)), sig) then
            return false
        end
    end
    
    -- Advanced environment fingerprinting
    local env_signature = 0
    for k, v in pairs(getfenv()) do
        env_signature = env_signature + #tostring(k) * #tostring(type(v))
    end
    
    -- Check against expected signature (varies by project)
    local expected_range = {${this.generateExpectedRange(project)}}
    if env_signature < expected_range[1] or env_signature > expected_range[2] then
        return false
    end
    
    return true
end

if not _premium_checks() then
    return false
end`;

        // Insert premium checks
        const insertPoint = loader.indexOf('-- Perform anti-debugging checks');
        if (insertPoint !== -1) {
            return loader.substring(0, insertPoint) + 
                   premiumFeatures + '\n\n' +
                   loader.substring(insertPoint);
        }

        return loader;
    }

    generateProjectHash(project) {
        const hashInput = project.projectId + project.name + (project.createdAt || '');
        return crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);
    }

    generateExpectedRange(project) {
        const base = parseInt(project.projectId.replace(/\D/g, '').substring(0, 4) || '1000');
        return `${base - 100}, ${base + 100}`;
    }

    generateIntegrityHash(code) {
        let hash = 0;
        for (let i = 0; i < code.length; i++) {
            hash = hash + code.charCodeAt(i) * (i + 1);
        }
        return (hash % 999999).toString();
    }

    getLoaderFeatures(options) {
        return {
            obfuscated: options.obfuscateLoader !== false,
            antiTamper: true,
            integrityChecks: true,
            antiDebugging: true,
            environmentFingerprinting: true,
            secureExecution: true,
            tamperMonitoring: true
        };
    }

    isReservedWord(word) {
        const reserved = [
            'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
            'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat',
            'return', 'then', 'true', 'until', 'while', 'print', 'pairs',
            'ipairs', 'next', 'type', 'getmetatable', 'setmetatable',
            'HttpService', 'Players', 'RunService', 'game', 'workspace'
        ];
        return reserved.includes(word);
    }

    // Static method for easy usage
    static generate(project, options = {}) {
        const generator = new LoaderGenerator();
        return generator.generateLoader(project, options);
    }
}

module.exports = LoaderGenerator;
