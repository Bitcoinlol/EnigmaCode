// Dashboard JavaScript
class Dashboard {
    constructor() {
        this.currentTab = 'dashboard';
        this.charts = {};
        this.data = {
            projects: [],
            keys: [],
            users: [],
            analytics: {},
            apiKeys: []
        };
        this.init();
    }

    async init() {
        // Check authentication
        if (!auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize UI
        this.initializeEventListeners();
        this.initializeCharts();
        
        // Load initial data
        await this.loadUserProfile();
        await this.loadDashboardData();
        
        // Set up auto-refresh
        this.setupAutoRefresh();
    }

    initializeEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                this.showTab(tab);
            });
        });

        // Form submissions
        document.getElementById('accountSettingsForm')?.addEventListener('submit', this.handleAccountSettings.bind(this));
        document.getElementById('passwordChangeForm')?.addEventListener('submit', this.handlePasswordChange.bind(this));

        // Search and filters
        document.getElementById('keysSearch')?.addEventListener('input', this.filterKeys.bind(this));
        document.getElementById('keysStatusFilter')?.addEventListener('change', this.filterKeys.bind(this));
        document.getElementById('keysProjectFilter')?.addEventListener('change', this.filterKeys.bind(this));

        // Analytics timeframe changes
        document.getElementById('usageTimeframe')?.addEventListener('change', this.updateUsageChart.bind(this));
        document.getElementById('analyticsTimeframe')?.addEventListener('change', this.loadAnalytics.bind(this));
    }

    initializeCharts() {
        // Usage Chart
        const usageCtx = document.getElementById('usageChart');
        if (usageCtx) {
            this.charts.usage = new Chart(usageCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Key Activations',
                        data: [],
                        borderColor: '#8B5CF6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#D1D5DB'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#9CA3AF' },
                            grid: { color: '#374151' }
                        },
                        y: {
                            ticks: { color: '#9CA3AF' },
                            grid: { color: '#374151' }
                        }
                    }
                }
            });
        }

        // Analytics Chart
        const analyticsCtx = document.getElementById('analyticsChart');
        if (analyticsCtx) {
            this.charts.analytics = new Chart(analyticsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Events',
                        data: [],
                        backgroundColor: '#8B5CF6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#D1D5DB'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#9CA3AF' },
                            grid: { color: '#374151' }
                        },
                        y: {
                            ticks: { color: '#9CA3AF' },
                            grid: { color: '#374151' }
                        }
                    }
                }
            });
        }

        // Error Chart
        const errorCtx = document.getElementById('errorChart');
        if (errorCtx) {
            this.charts.error = new Chart(errorCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#EF4444',
                            '#F59E0B',
                            '#8B5CF6',
                            '#10B981',
                            '#3B82F6'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#D1D5DB'
                            }
                        }
                    }
                }
            });
        }
    }

    async loadUserProfile() {
        try {
            const user = auth.getCurrentUser();
            document.getElementById('userName').textContent = user.username;
            document.getElementById('userPlan').textContent = `${user.subscription.plan} Plan`;
            
            // Update settings form
            document.getElementById('settingsEmail').value = user.email;
            document.getElementById('settingsUsername').value = user.username;
            document.getElementById('currentPlan').textContent = `${user.subscription.plan} Plan`;
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    async loadDashboardData() {
        try {
            // Load stats
            await this.loadStats();
            
            // Load activity feed
            await this.loadActivityFeed();
            
            // Load usage chart
            await this.updateUsageChart();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadStats() {
        try {
            const stats = await auth.apiRequest('/users/stats/platform');
            
            document.getElementById('totalProjects').textContent = auth.getCurrentUser().stats.totalProjects || 0;
            document.getElementById('totalActiveUsers').textContent = stats.totalActiveUsers || 0;
            document.getElementById('totalKeys').textContent = stats.totalKeys || 0;
            document.getElementById('totalBannedUsers').textContent = stats.totalBannedUsers || 0;
            
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadActivityFeed() {
        try {
            const analytics = await auth.apiRequest('/analytics/dashboard?timeframe=24h');
            const feedContainer = document.getElementById('activityFeed');
            
            if (analytics.recentActivity && analytics.recentActivity.length > 0) {
                feedContainer.innerHTML = analytics.recentActivity.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${this.getActivityIconClass(activity.type)}">
                            <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">${this.getActivityText(activity)}</div>
                            <div class="activity-time">${this.formatTimeAgo(activity.createdAt)}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                feedContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-chart-line"></i>
                        <h3>No Recent Activity</h3>
                        <p>Activity will appear here once you start using the platform</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load activity feed:', error);
        }
    }

    async updateUsageChart() {
        try {
            const timeframe = document.getElementById('usageTimeframe')?.value || '7d';
            const data = await auth.apiRequest(`/analytics/usage?timeframe=${timeframe}&type=activation`);
            
            if (this.charts.usage && data.data) {
                const labels = data.data.map(item => item._id.date);
                const values = data.data.map(item => item.count);
                
                this.charts.usage.data.labels = labels;
                this.charts.usage.data.datasets[0].data = values;
                this.charts.usage.update();
            }
        } catch (error) {
            console.error('Failed to update usage chart:', error);
        }
    }

    async loadProjects() {
        try {
            const response = await auth.apiRequest('/projects');
            this.data.projects = response.projects;
            this.renderProjects();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.showError('Failed to load projects');
        }
    }

    renderProjects() {
        const container = document.getElementById('projectsGrid');
        
        if (this.data.projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-plus"></i>
                    <h3>No Projects Yet</h3>
                    <p>Create your first project to start protecting your Lua scripts</p>
                    <button class="btn-primary" onclick="dashboard.showCreateProjectModal()">
                        <i class="fas fa-plus"></i>
                        Create Project
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <h3 class="project-name">${project.name}</h3>
                    <span class="project-status ${project.isActive ? 'active' : 'inactive'}">
                        ${project.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <p class="project-description">${project.description || 'No description'}</p>
                <div class="project-stats">
                    <div class="project-stat">
                        <div class="project-stat-value">${project.stats.totalKeys}</div>
                        <div class="project-stat-label">Keys</div>
                    </div>
                    <div class="project-stat">
                        <div class="project-stat-value">${project.stats.totalActivations}</div>
                        <div class="project-stat-label">Activations</div>
                    </div>
                    <div class="project-stat">
                        <div class="project-stat-value">${project.stats.uniqueUsers}</div>
                        <div class="project-stat-label">Users</div>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn-primary btn-sm" onclick="dashboard.viewProject('${project.projectId}')">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn-secondary btn-sm" onclick="dashboard.editProject('${project.projectId}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn-secondary btn-sm" onclick="dashboard.getLoader('${project.projectId}')">
                        <i class="fas fa-download"></i>
                        Loader
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadKeys() {
        try {
            const response = await auth.apiRequest('/keys');
            this.data.keys = response.keys;
            this.renderKeys();
            this.populateProjectFilter();
        } catch (error) {
            console.error('Failed to load keys:', error);
            this.showError('Failed to load keys');
        }
    }

    renderKeys() {
        const tbody = document.getElementById('keysTableBody');
        
        if (this.data.keys.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-key"></i>
                            <h3>No Keys Yet</h3>
                            <p>Create your first license key to start protecting your scripts</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.data.keys.map(key => `
            <tr>
                <td>
                    <code>${key.keyString.substring(0, 16)}...</code>
                    <button class="btn-xs" onclick="dashboard.copyToClipboard('${key.keyString}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </td>
                <td>
                    <span class="status-badge ${key.status}">${key.status}</span>
                </td>
                <td>${key.project?.name || 'Unknown'}</td>
                <td>${this.formatDate(key.createdAt)}</td>
                <td>${key.expiresAt ? this.formatDate(key.expiresAt) : 'Never'}</td>
                <td>${key.usage.lastUsed ? this.formatTimeAgo(key.usage.lastUsed) : 'Never'}</td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn-secondary btn-xs" onclick="dashboard.viewKey('${key.keyId}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-secondary btn-xs" onclick="dashboard.editKey('${key.keyId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-secondary btn-xs" onclick="dashboard.banKey('${key.keyId}')">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async loadAnalytics() {
        try {
            const timeframe = document.getElementById('analyticsTimeframe')?.value || '30d';
            const analytics = await auth.apiRequest(`/analytics/dashboard?timeframe=${timeframe}`);
            
            this.data.analytics = analytics;
            this.updateAnalyticsCharts();
            this.loadErrorLogs();
        } catch (error) {
            console.error('Failed to load analytics:', error);
            this.showError('Failed to load analytics');
        }
    }

    updateAnalyticsCharts() {
        if (this.charts.analytics && this.data.analytics.dailyStats) {
            const dates = Object.keys(this.data.analytics.dailyStats);
            const activations = dates.map(date => this.data.analytics.dailyStats[date].activation || 0);
            
            this.charts.analytics.data.labels = dates;
            this.charts.analytics.data.datasets[0].data = activations;
            this.charts.analytics.update();
        }

        if (this.charts.error && this.data.analytics.typeStats) {
            const errorTypes = Object.keys(this.data.analytics.typeStats);
            const errorCounts = errorTypes.map(type => this.data.analytics.typeStats[type]);
            
            this.charts.error.data.labels = errorTypes;
            this.charts.error.data.datasets[0].data = errorCounts;
            this.charts.error.update();
        }
    }

    async loadErrorLogs() {
        try {
            const errors = await auth.apiRequest('/analytics/errors');
            const container = document.getElementById('errorLog');
            
            if (errors.errors && errors.errors.length > 0) {
                container.innerHTML = errors.errors.map(error => `
                    <div class="log-entry">
                        <span class="log-timestamp">${this.formatDate(error.createdAt)}</span>
                        <span class="log-level error">[ERROR]</span>
                        <span>${error.data.errorCode}: ${error.data.errorMessage}</span>
                        <span class="text-muted">- Project: ${error.projectId?.name || 'Unknown'}</span>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div class="text-center text-muted">No errors found</div>';
            }
        } catch (error) {
            console.error('Failed to load error logs:', error);
        }
    }

    async loadApiKeys() {
        try {
            const response = await auth.apiRequest('/management/keys');
            this.data.apiKeys = response.apiKeys;
            this.renderApiKeys();
        } catch (error) {
            console.error('Failed to load API keys:', error);
            this.showError('Failed to load API keys');
        }
    }

    renderApiKeys() {
        const container = document.getElementById('apiKeysList');
        
        if (this.data.apiKeys.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code"></i>
                    <h3>No API Keys</h3>
                    <p>Create an API key to access the EnigmaCode API programmatically</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.apiKeys.map(key => `
            <div class="api-key-item">
                <div class="api-key-info">
                    <h4>${key.name}</h4>
                    <p>${key.key}</p>
                    <small class="text-muted">Created: ${this.formatDate(key.createdAt)}</small>
                    ${key.lastUsed ? `<small class="text-muted">Last used: ${this.formatTimeAgo(key.lastUsed)}</small>` : ''}
                </div>
                <div class="api-key-actions">
                    <button class="btn-secondary btn-sm" onclick="dashboard.toggleApiKey('${key.keyId}')">
                        ${key.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn-secondary btn-sm" onclick="dashboard.deleteApiKey('${key.keyId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Tab Management
    showTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            projects: 'Projects',
            keys: 'License Keys',
            users: 'Users',
            analytics: 'Analytics',
            api: 'API Management',
            settings: 'Settings'
        };
        document.getElementById('pageTitle').textContent = titles[tabName];

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'projects':
                await this.loadProjects();
                break;
            case 'keys':
                await this.loadKeys();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'analytics':
                await this.loadAnalytics();
                break;
            case 'api':
                await this.loadApiKeys();
                await this.loadApiDocs();
                break;
        }
    }

    // Utility Methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    }

    getActivityIconClass(type) {
        const classes = {
            activation: 'success',
            error: 'error',
            ban: 'error',
            tamper: 'warning'
        };
        return classes[type] || 'success';
    }

    getActivityIcon(type) {
        const icons = {
            activation: 'fa-check',
            error: 'fa-exclamation-triangle',
            ban: 'fa-ban',
            tamper: 'fa-shield-alt'
        };
        return icons[type] || 'fa-info';
    }

    getActivityText(activity) {
        const texts = {
            activation: 'Key validated successfully',
            error: `Error: ${activity.data?.errorCode || 'Unknown error'}`,
            ban: 'User banned',
            tamper: 'Tamper attempt detected'
        };
        return texts[activity.type] || 'Unknown activity';
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('Copied to clipboard!');
        });
    }

    showError(message) {
        // Implementation for showing error messages
        console.error(message);
    }

    showSuccess(message) {
        // Implementation for showing success messages
        console.log(message);
    }

    setupAutoRefresh() {
        // Refresh dashboard data every 30 seconds
        setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.loadStats();
                this.loadActivityFeed();
            }
        }, 30000);
    }
}

// Global functions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

function handleLogout() {
    auth.logout();
    window.location.href = 'login.html';
}

function refreshData() {
    dashboard.loadTabData(dashboard.currentTab);
}

function showTab(tabName) {
    dashboard.showTab(tabName);
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});

// Export for global access
window.dashboard = dashboard;
