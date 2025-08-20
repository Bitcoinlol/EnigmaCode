// Authentication JavaScript utilities
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        this.apiBase = '/api';
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Get auth headers for API requests
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Make authenticated API request
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Login user
    async login(credentials) {
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response. Please check if the API server is running.');
            }

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                return data;
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            if (error.name === 'SyntaxError') {
                throw new Error('API server is not responding. Please check if the backend is running.');
            }
            throw error;
        }
    }

    // Register user
    async register(userData) {
        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response. Please check if the API server is running.');
            }

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                return data;
            } else {
                throw new Error(data.error || 'Registration failed');
            }
        } catch (error) {
            if (error.name === 'SyntaxError') {
                throw new Error('API server is not responding. Please check if the backend is running.');
            }
            throw error;
        }
    }

    // Logout user
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Update user profile
    async updateProfile(profileData) {
        return await this.apiRequest('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Change password
    async changePassword(passwordData) {
        return await this.apiRequest('/auth/password', {
            method: 'PUT',
            body: JSON.stringify(passwordData)
        });
    }

    // Verify token
    async verifyToken() {
        try {
            const data = await this.apiRequest('/auth/verify');
            return data.valid;
        } catch (error) {
            return false;
        }
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Update stored user data
    updateUser(userData) {
        this.user = { ...this.user, ...userData };
        localStorage.setItem('user', JSON.stringify(this.user));
    }
}

// Global auth manager instance
const auth = new AuthManager();

// Utility functions
function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `${type}-message`;
        element.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }
}

function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
    }
}

function setButtonLoading(button, loading = true) {
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (loading) {
        btnText?.classList.add('hidden');
        btnLoading?.classList.remove('hidden');
        button.disabled = true;
    } else {
        btnText?.classList.remove('hidden');
        btnLoading?.classList.add('hidden');
        button.disabled = false;
    }
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return {
        length: password.length >= 6,
        hasLower: /[a-z]/.test(password),
        hasUpper: /[A-Z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
}

function getPasswordStrength(password) {
    const checks = validatePassword(password);
    let score = 0;
    
    if (checks.length) score += 20;
    if (checks.hasLower) score += 20;
    if (checks.hasUpper) score += 20;
    if (checks.hasNumber) score += 20;
    if (checks.hasSpecial) score += 20;
    
    return {
        score,
        level: score < 40 ? 'weak' : score < 80 ? 'medium' : 'strong'
    };
}

// Form validation utilities
function addFormValidation(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const inputs = form.querySelectorAll('input[required]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateInput(input));
        input.addEventListener('input', () => clearInputError(input));
    });
}

function validateInput(input) {
    const value = input.value.trim();
    let isValid = true;
    let message = '';
    
    // Required validation
    if (input.hasAttribute('required') && !value) {
        isValid = false;
        message = 'This field is required';
    }
    
    // Email validation
    if (input.type === 'email' && value && !validateEmail(value)) {
        isValid = false;
        message = 'Please enter a valid email address';
    }
    
    // Password validation
    if (input.type === 'password' && input.name === 'password' && value) {
        const strength = getPasswordStrength(value);
        if (strength.score < 40) {
            isValid = false;
            message = 'Password is too weak';
        }
    }
    
    // Confirm password validation
    if (input.name === 'confirmPassword' && value) {
        const passwordInput = form.querySelector('input[name="password"]');
        if (passwordInput && value !== passwordInput.value) {
            isValid = false;
            message = 'Passwords do not match';
        }
    }
    
    // Username validation
    if (input.name === 'username' && value) {
        if (value.length < 3) {
            isValid = false;
            message = 'Username must be at least 3 characters';
        } else if (value.length > 30) {
            isValid = false;
            message = 'Username must be less than 30 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            isValid = false;
            message = 'Username can only contain letters, numbers, and underscores';
        }
    }
    
    showInputValidation(input, isValid, message);
    return isValid;
}

function showInputValidation(input, isValid, message) {
    // Remove existing validation
    clearInputError(input);
    
    if (!isValid) {
        input.classList.add('error');
        input.style.borderColor = 'var(--error-color)';
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'input-error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            color: var(--error-color);
            font-size: var(--font-size-sm);
            margin-top: var(--spacing-xs);
        `;
        
        input.parentNode.appendChild(errorDiv);
    } else if (input.value.trim()) {
        input.style.borderColor = 'var(--success-color)';
    }
}

function clearInputError(input) {
    input.classList.remove('error');
    input.style.borderColor = '';
    
    const errorDiv = input.parentNode.querySelector('.input-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('input[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Route protection
function requireAuth() {
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function redirectIfAuthenticated() {
    if (auth.isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return true;
    }
    return false;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a protected page
    const protectedPages = ['dashboard.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        requireAuth();
    }
    
    // Check if we're on auth pages and user is already logged in
    const authPages = ['login.html', 'register.html'];
    if (authPages.includes(currentPage)) {
        redirectIfAuthenticated();
    }
    
    // Add form validation to auth forms
    addFormValidation('loginForm');
    addFormValidation('registerForm');
});

// Export for use in other scripts
window.auth = auth;
window.authUtils = {
    showMessage,
    hideMessage,
    setButtonLoading,
    validateEmail,
    validatePassword,
    getPasswordStrength,
    validateForm,
    requireAuth,
    redirectIfAuthenticated
};
