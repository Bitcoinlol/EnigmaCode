// Advanced Lua Obfuscation Engine
const crypto = require('crypto');

class LuaObfuscator {
    constructor(options = {}) {
        this.options = {
            tier: options.tier || 'standard',
            stringEncryption: options.stringEncryption !== false,
            variableRenaming: options.variableRenaming !== false,
            antiDebugging: options.antiDebugging !== false,
            controlFlowFlattening: options.controlFlowFlattening || false,
            bytecodeEncryption: options.bytecodeEncryption || false,
            virtualization: options.virtualization || false,
            integrityChecks: options.integrityChecks !== false,
            ...options
        };
        
        this.variableMap = new Map();
        this.stringMap = new Map();
        this.functionMap = new Map();
        this.varCounter = 0;
        this.stringCounter = 0;
        this.functionCounter = 0;
    }

    obfuscate(sourceCode) {
        let obfuscated = sourceCode;
        
        // Apply obfuscation techniques based on tier
        if (this.options.stringEncryption) {
            obfuscated = this.encryptStrings(obfuscated);
        }
        
        if (this.options.variableRenaming) {
            obfuscated = this.renameVariables(obfuscated);
        }
        
        if (this.options.antiDebugging) {
            obfuscated = this.addAntiDebugging(obfuscated);
        }
        
        // Premium tier features
        if (this.options.tier === 'premium') {
            if (this.options.controlFlowFlattening) {
                obfuscated = this.flattenControlFlow(obfuscated);
            }
            
            if (this.options.bytecodeEncryption) {
                obfuscated = this.encryptBytecode(obfuscated);
            }
            
            if (this.options.virtualization) {
                obfuscated = this.virtualize(obfuscated);
            }
        }
        
        if (this.options.integrityChecks) {
            obfuscated = this.addIntegrityChecks(obfuscated);
        }
        
        return this.wrapObfuscatedCode(obfuscated);
    }

    encryptStrings(code) {
        // Find all string literals
        const stringRegex = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
        const strings = [];
        let match;
        
        while ((match = stringRegex.exec(code)) !== null) {
            strings.push({
                original: match[0],
                content: match[0].slice(1, -1), // Remove quotes
                index: match.index
            });
        }
        
        // Replace strings with encrypted versions
        let result = code;
        for (let i = strings.length - 1; i >= 0; i--) {
            const str = strings[i];
            const encrypted = this.encryptString(str.content);
            const decryptCall = `_G._EC_decrypt("${encrypted}")`;
            result = result.substring(0, str.index) + decryptCall + result.substring(str.index + str.original.length);
        }
        
        // Add decryption function
        const decryptFunction = this.generateDecryptFunction();
        return decryptFunction + '\n' + result;
    }

    encryptString(str) {
        const key = crypto.randomBytes(16);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', key);
        
        let encrypted = cipher.update(str, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Encode key and IV with the encrypted string
        const combined = key.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
        return Buffer.from(combined).toString('base64');
    }

    generateDecryptFunction() {
        return `
-- String decryption function
_G._EC_decrypt = function(encrypted)
    local base64_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local function base64_decode(data)
        data = string.gsub(data, '[^'..base64_chars..'=]', '')
        return (data:gsub('.', function(x)
            if (x == '=') then return '' end
            local r,f='',(base64_chars:find(x)-1)
            for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
            return r;
        end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
            if (#x ~= 8) then return '' end
            local c=0
            for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
            return string.char(c)
        end))
    end
    
    local decoded = base64_decode(encrypted)
    local parts = {}
    for part in decoded:gmatch("[^:]+") do
        table.insert(parts, part)
    end
    
    -- Simple XOR decryption for demo (in production, use proper AES)
    local key = parts[1]
    local result = ""
    local keyIndex = 1
    for i = 1, #parts[3] do
        local char = string.byte(parts[3], i)
        local keyChar = string.byte(key, ((keyIndex - 1) % #key) + 1)
        result = result .. string.char(char ~ keyChar)
        keyIndex = keyIndex + 1
    end
    
    return result
end`;
    }

    renameVariables(code) {
        // Find variable declarations and usages
        const patterns = [
            /local\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g
        ];
        
        let result = code;
        
        // First pass: identify variables
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                const varName = match[1];
                if (!this.isReservedWord(varName) && !this.variableMap.has(varName)) {
                    this.variableMap.set(varName, this.generateVariableName());
                }
            }
        });
        
        // Second pass: replace variables
        this.variableMap.forEach((newName, oldName) => {
            const regex = new RegExp(`\\b${oldName}\\b`, 'g');
            result = result.replace(regex, newName);
        });
        
        return result;
    }

    generateVariableName() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const nums = '0123456789';
        let name = '_';
        
        // Generate obfuscated variable name
        for (let i = 0; i < 8; i++) {
            if (i === 0) {
                name += chars[Math.floor(Math.random() * chars.length)];
            } else {
                const charset = chars + nums;
                name += charset[Math.floor(Math.random() * charset.length)];
            }
        }
        
        return name + this.varCounter++;
    }

    isReservedWord(word) {
        const reserved = [
            'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
            'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat',
            'return', 'then', 'true', 'until', 'while', 'print', 'pairs',
            'ipairs', 'next', 'type', 'getmetatable', 'setmetatable'
        ];
        return reserved.includes(word);
    }

    addAntiDebugging(code) {
        const antiDebugChecks = `
-- Anti-debugging protection
local function _EC_antiDebug()
    -- Check for debug library
    if debug and debug.getinfo then
        error("Debug library detected", 0)
    end
    
    -- Check for common debugging functions
    local banned = {"debug", "getfenv", "setfenv", "loadstring", "dofile", "loadfile"}
    for _, func in pairs(banned) do
        if _G[func] then
            _G[func] = function() error("Function blocked", 0) end
        end
    end
    
    -- Environment integrity check
    local env_hash = 0
    for k, v in pairs(_G) do
        env_hash = env_hash + #tostring(k) + #tostring(type(v))
    end
    
    return env_hash
end

local _EC_hash = _EC_antiDebug()
`;
        
        return antiDebugChecks + code;
    }

    flattenControlFlow(code) {
        // Control flow flattening - convert if/else and loops to switch-like structures
        let result = code;
        
        // Find if-then-else blocks and flatten them
        const ifPattern = /if\s+(.+?)\s+then\s+(.*?)\s+(?:else\s+(.*?)\s+)?end/gs;
        
        result = result.replace(ifPattern, (match, condition, thenBlock, elseBlock) => {
            const stateVar = this.generateVariableName();
            const conditionVar = this.generateVariableName();
            
            let flattened = `
local ${conditionVar} = ${condition}
local ${stateVar} = ${conditionVar} and 1 or 2

while ${stateVar} ~= 0 do
    if ${stateVar} == 1 then
        ${thenBlock}
        ${stateVar} = 0
    elseif ${stateVar} == 2 then
        ${elseBlock || ''}
        ${stateVar} = 0
    end
end`;
            
            return flattened;
        });
        
        return result;
    }

    encryptBytecode(code) {
        // Simulate bytecode encryption by encoding the entire script
        const encoded = Buffer.from(code).toString('base64');
        const key = crypto.randomBytes(32).toString('hex');
        
        return `
-- Bytecode encryption wrapper
local function _EC_decrypt_bytecode(encoded, key)
    local decoded = ""
    local keyIndex = 1
    
    -- Base64 decode
    local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    encoded = encoded:gsub('[^'..b64chars..'=]', '')
    local padded = encoded:gsub('.', function(x)
        if x == '=' then return '' end
        local r, f = '', (b64chars:find(x) - 1)
        for i = 6, 1, -1 do
            r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0')
        end
        return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if #x ~= 8 then return '' end
        local c = 0
        for i = 1, 8 do
            c = c + (x:sub(i,i) == '1' and 2^(8-i) or 0)
        end
        return string.char(c)
    end)
    
    -- XOR decrypt
    for i = 1, #decoded do
        local char = string.byte(decoded, i)
        local keyChar = string.byte(key, ((keyIndex - 1) % #key) + 1)
        decoded = decoded .. string.char(char ~ keyChar)
        keyIndex = keyIndex + 1
    end
    
    return decoded
end

local _EC_code = "${encoded}"
local _EC_key = "${key}"
local _EC_decrypted = _EC_decrypt_bytecode(_EC_code, _EC_key)
loadstring(_EC_decrypted)()`;
    }

    virtualize(code) {
        // Create a simple virtual machine for Lua code execution
        return `
-- Virtual Machine Protection
local _EC_VM = {
    stack = {},
    registers = {},
    pc = 1,
    instructions = {}
}

function _EC_VM:push(value)
    table.insert(self.stack, value)
end

function _EC_VM:pop()
    return table.remove(self.stack)
end

function _EC_VM:execute()
    while self.pc <= #self.instructions do
        local instr = self.instructions[self.pc]
        local op = instr[1]
        
        if op == "LOAD" then
            self:push(instr[2])
        elseif op == "CALL" then
            local func = self:pop()
            local args = {}
            for i = 1, instr[2] do
                table.insert(args, 1, self:pop())
            end
            local result = func(unpack(args))
            if result ~= nil then
                self:push(result)
            end
        elseif op == "JMP" then
            self.pc = instr[2] - 1
        end
        
        self.pc = self.pc + 1
    end
end

-- Convert original code to VM instructions
${this.codeToVMInstructions(code)}
_EC_VM:execute()`;
    }

    codeToVMInstructions(code) {
        // Simplified conversion - in production this would be much more sophisticated
        const lines = code.split('\n');
        let instructions = [];
        
        lines.forEach(line => {
            line = line.trim();
            if (line.includes('print(')) {
                const match = line.match(/print\((.+)\)/);
                if (match) {
                    instructions.push(`{"LOAD", print}`);
                    instructions.push(`{"LOAD", ${match[1]}}`);
                    instructions.push(`{"CALL", 1}`);
                }
            }
        });
        
        return `_EC_VM.instructions = {${instructions.join(', ')}}`;
    }

    addIntegrityChecks(code) {
        const hash = crypto.createHash('sha256').update(code).digest('hex');
        
        return `
-- Integrity verification
local function _EC_verify_integrity()
    local current_code = debug.getinfo(1, "S").source
    local expected_hash = "${hash}"
    
    -- Simple hash check (in production, use proper hashing)
    local actual_hash = 0
    for i = 1, #current_code do
        actual_hash = actual_hash + string.byte(current_code, i)
    end
    
    if tostring(actual_hash) ~= expected_hash then
        error("Code integrity violation detected", 0)
    end
end

_EC_verify_integrity()
${code}`;
    }

    wrapObfuscatedCode(code) {
        const wrapper = `
-- EnigmaCode Protected Script
-- Unauthorized modification or reverse engineering is prohibited
-- Generated: ${new Date().toISOString()}

(function()
    local _EC_protected = function()
        ${code}
    end
    
    -- Execute in protected environment
    local success, error = pcall(_EC_protected)
    if not success then
        -- Silent failure - no error reporting
        return
    end
end)()`;
        
        return wrapper;
    }

    // Static method for easy usage
    static obfuscate(code, options = {}) {
        const obfuscator = new LuaObfuscator(options);
        return obfuscator.obfuscate(code);
    }
}

module.exports = LuaObfuscator;
