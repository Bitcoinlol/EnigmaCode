-- EnigmaCode Tamper-Resistant Loader v2.0
-- This loader provides maximum security and tamper resistance
-- Generated dynamically for each project

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

-- Configuration (will be replaced during generation)
local CONFIG = {
    API_BASE = "{{API_BASE_URL}}",
    PROJECT_ID = "{{PROJECT_ID}}",
    INTEGRITY_HASH = "{{INTEGRITY_HASH}}",
    OBFUSCATION_KEY = "{{OBFUSCATION_KEY}}",
    ANTI_TAMPER_KEY = "{{ANTI_TAMPER_KEY}}"
}

-- Anti-tamper protection
local LOADER_HASH = "{{LOADER_HASH}}"
local EXECUTION_COUNT = 0
local MAX_EXECUTIONS = 1
local ENVIRONMENT_CHECKS = {}

-- Integrity verification
local function verifyLoaderIntegrity()
    local source = debug.getinfo(1, "S").source or ""
    local currentHash = 0
    
    -- Simple hash calculation (in production, use proper hashing)
    for i = 1, #source do
        currentHash = currentHash + string.byte(source, i) * i
    end
    
    if tostring(currentHash % 999999) ~= LOADER_HASH then
        return false
    end
    
    return true
end

-- Environment fingerprinting
local function generateEnvironmentFingerprint()
    local fingerprint = {
        game_id = game.GameId or 0,
        place_id = game.PlaceId or 0,
        player_count = #Players:GetPlayers(),
        server_type = game.PrivateServerId and "private" or "public",
        timestamp = tick()
    }
    
    local hash = 0
    for k, v in pairs(fingerprint) do
        hash = hash + #tostring(k) + #tostring(v)
    end
    
    return hash
end

-- Anti-debugging checks
local function performAntiDebugChecks()
    -- Check 1: Debug library detection
    if debug and debug.getinfo then
        return false
    end
    
    -- Check 2: Environment pollution detection
    local suspicious_globals = {
        "getfenv", "setfenv", "loadstring", "dofile", "loadfile"
    }
    
    for _, func_name in pairs(suspicious_globals) do
        if _G[func_name] then
            return false
        end
    end
    
    -- Check 3: Execution time analysis
    local start_time = tick()
    for i = 1, 1000 do
        math.random()
    end
    local execution_time = tick() - start_time
    
    if execution_time > 0.1 then -- Suspiciously slow execution
        return false
    end
    
    -- Check 4: Memory usage analysis
    local memory_before = collectgarbage("count")
    local dummy_table = {}
    for i = 1, 100 do
        dummy_table[i] = string.rep("a", 100)
    end
    local memory_after = collectgarbage("count")
    dummy_table = nil
    collectgarbage()
    
    if (memory_after - memory_before) > 50 then -- Unexpected memory usage
        return false
    end
    
    return true
end

-- Network request with retry and validation
local function makeSecureRequest(endpoint, headers, retries)
    retries = retries or 3
    
    for attempt = 1, retries do
        local success, response = pcall(function()
            return HttpService:GetAsync(CONFIG.API_BASE .. endpoint, {
                ["Content-Type"] = "application/json",
                ["X-Project-ID"] = CONFIG.PROJECT_ID,
                ["X-User-Key"] = headers["X-User-Key"],
                ["X-User-ID"] = headers["X-User-ID"] or "",
                ["X-Loader-Version"] = "2.0",
                ["X-Environment-Hash"] = tostring(generateEnvironmentFingerprint()),
                ["X-Integrity-Check"] = CONFIG.INTEGRITY_HASH
            })
        end)
        
        if success then
            -- Validate response format
            local data = HttpService:JSONDecode(response)
            if data and type(data) == "table" then
                return data
            end
        end
        
        if attempt < retries then
            wait(math.random(1, 3)) -- Random delay between retries
        end
    end
    
    return nil
end

-- Code decryption and validation
local function decryptAndValidateCode(encryptedCode, key)
    if not encryptedCode or not key then
        return nil
    end
    
    -- Base64 decode
    local base64_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local decoded = encryptedCode:gsub('[^'..base64_chars..'=]', '')
    
    decoded = decoded:gsub('.', function(x)
        if x == '=' then return '' end
        local r, f = '', (base64_chars:find(x) - 1)
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
    
    -- XOR decrypt with key
    local decrypted = ""
    local keyIndex = 1
    
    for i = 1, #decoded do
        local char = string.byte(decoded, i)
        local keyChar = string.byte(key, ((keyIndex - 1) % #key) + 1)
        decrypted = decrypted .. string.char(char ~ keyChar)
        keyIndex = keyIndex + 1
    end
    
    -- Validate decrypted code integrity
    local codeHash = 0
    for i = 1, #decrypted do
        codeHash = codeHash + string.byte(decrypted, i) * (i % 255)
    end
    
    if tostring(codeHash % 999999) ~= CONFIG.INTEGRITY_HASH then
        return nil
    end
    
    return decrypted
end

-- Secure code execution
local function executeSecureCode(code)
    if not code or #code == 0 then
        return false
    end
    
    -- Create isolated environment
    local env = {
        -- Safe globals
        print = print,
        warn = warn,
        error = error,
        pairs = pairs,
        ipairs = ipairs,
        next = next,
        type = type,
        tostring = tostring,
        tonumber = tonumber,
        math = math,
        string = string,
        table = table,
        coroutine = coroutine,
        
        -- Game services (limited)
        game = game,
        workspace = workspace,
        Players = Players,
        RunService = RunService,
        
        -- Custom globals
        _G = {},
        _VERSION = "EnigmaCode Protected Environment"
    }
    
    -- Compile and execute in protected environment
    local success, compiled = pcall(loadstring, code)
    if not success or not compiled then
        return false
    end
    
    setfenv(compiled, env)
    
    local exec_success, exec_error = pcall(compiled)
    if not exec_success then
        -- Silent failure - no error reporting to prevent information leakage
        return false
    end
    
    return true
end

-- Main validation and execution function
local function validateAndExecute(userKey, userId)
    -- Increment execution counter
    EXECUTION_COUNT = EXECUTION_COUNT + 1
    
    -- Check execution limits
    if EXECUTION_COUNT > MAX_EXECUTIONS then
        return false
    end
    
    -- Verify loader integrity
    if not verifyLoaderIntegrity() then
        return false
    end
    
    -- Perform anti-debugging checks
    if not performAntiDebugChecks() then
        return false
    end
    
    -- Validate input parameters
    if not userKey or type(userKey) ~= "string" or #userKey < 10 then
        return false
    end
    
    userId = userId or (Players.LocalPlayer and tostring(Players.LocalPlayer.UserId)) or ""
    
    -- Make secure API request
    local response = makeSecureRequest("/loader/validate", {
        ["X-User-Key"] = userKey,
        ["X-User-ID"] = userId
    })
    
    if not response or not response.valid then
        return false
    end
    
    -- Decrypt and validate code
    local decryptedCode = decryptAndValidateCode(response.code, CONFIG.OBFUSCATION_KEY)
    if not decryptedCode then
        return false
    end
    
    -- Execute code securely
    return executeSecureCode(decryptedCode)
end

-- Anti-tampering monitoring
local function startTamperMonitoring()
    spawn(function()
        while true do
            wait(math.random(5, 15)) -- Random intervals
            
            -- Check loader integrity periodically
            if not verifyLoaderIntegrity() then
                -- Trigger global ban by making invalid request
                makeSecureRequest("/loader/tamper-detected", {
                    ["X-User-Key"] = "TAMPER_DETECTED",
                    ["X-User-ID"] = Players.LocalPlayer and tostring(Players.LocalPlayer.UserId) or ""
                })
                break
            end
            
            -- Check for environment modifications
            local currentFingerprint = generateEnvironmentFingerprint()
            if ENVIRONMENT_CHECKS[1] and math.abs(currentFingerprint - ENVIRONMENT_CHECKS[1]) > 1000 then
                -- Environment significantly changed - possible tampering
                break
            end
            
            table.insert(ENVIRONMENT_CHECKS, currentFingerprint)
            if #ENVIRONMENT_CHECKS > 10 then
                table.remove(ENVIRONMENT_CHECKS, 1)
            end
        end
    end)
end

-- Initialize tamper monitoring
startTamperMonitoring()

-- Export main function
return validateAndExecute
