/**
 * PluginsPage - MCP plugins and marketplaces management page
 * Displays installed plugins, available marketplaces, and permissions
 */
class PluginsPage {
  constructor(container, services) {
    this.container = container;
    this.dataService = services.data;
    this.stateService = services.state;

    this.plugins = [];
    this.marketplaces = [];
    this.summary = {};
    this.isInitialized = false;
    this.refreshInterval = null;

    // Filter state
    this.filterState = {
      status: 'all',
      search: ''
    };
  }

  /**
   * Initialize the plugins page
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🔌 Initializing PluginsPage...');

    try {
      await this.render();
      this.stateService.setLoading(true);
      await this.loadInitialData();
      this.bindEvents();
      this.startPeriodicRefresh();
      this.isInitialized = true;
      console.log('✅ PluginsPage fully initialized!');
    } catch (error) {
      console.error('❌ Error during plugins page initialization:', error);
      this.showError('Failed to load plugins data');
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Fetch plugin data from API
      const response = await fetch('/api/plugins-data');
      const data = await response.json();

      this.plugins = data.plugins || [];
      this.marketplaces = data.marketplaces || [];
      this.summary = data.summary || {};

      this.updateDisplay();
    } catch (error) {
      console.error('Error loading plugins data:', error);
      // Use mock data as fallback
      this.loadMockData();
      this.updateDisplay();
    }
  }

  /**
   * Load mock data for development
   */
  loadMockData() {
    this.plugins = [
      {
        id: 'mcp-1',
        name: 'GitHub Integration',
        status: 'active',
        marketplace: 'Official',
        description: 'Access GitHub repositories and issues',
        permissions: ['read:repo', 'write:issues']
      },
      {
        id: 'mcp-2',
        name: 'PostgreSQL',
        status: 'active',
        marketplace: 'Official',
        description: 'Database integration for PostgreSQL',
        permissions: ['read:db', 'write:db']
      },
      {
        id: 'mcp-3',
        name: 'Web Fetch',
        status: 'inactive',
        marketplace: 'Official',
        description: 'Fetch web content and APIs',
        permissions: ['network:fetch']
      }
    ];

    this.marketplaces = [
      { name: 'Official', status: 'active', pluginCount: 15 },
      { name: 'Community', status: 'active', pluginCount: 42 },
      { name: 'Development', status: 'inactive', pluginCount: 3 }
    ];

    this.summary = {
      totalPlugins: this.plugins.length,
      activePlugins: this.plugins.filter(p => p.status === 'active').length,
      totalMarketplaces: this.marketplaces.length
    };
  }

  /**
   * Render the plugins page structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="plugins-page">
        <!-- Header -->
        <div class="page-header">
          <div class="page-title-section">
            <h1 class="page-title">🔌 Plugins & MCPs</h1>
            <p class="page-subtitle">Manage MCP servers, plugins, and marketplace connections</p>
          </div>
          <div class="page-actions">
            <button class="action-btn-small" id="refresh-plugins" title="Refresh plugins">
              <span class="btn-icon-small">🔄</span>
              Refresh
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" id="plugins-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span class="loading-text">Loading plugins...</span>
        </div>

        <!-- Error State -->
        <div class="error-state" id="plugins-error" style="display: none;">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-message"></span>
            <button class="error-retry" id="plugins-retry-load">Retry</button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="plugins-content" id="plugins-content">
          <!-- Summary Cards -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-icon">🔌</div>
              <div class="summary-details">
                <div class="summary-value" id="total-plugins">0</div>
                <div class="summary-label">Total Plugins</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">✅</div>
              <div class="summary-details">
                <div class="summary-value" id="active-plugins">0</div>
                <div class="summary-label">Active</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">🏪</div>
              <div class="summary-details">
                <div class="summary-value" id="total-marketplaces">0</div>
                <div class="summary-label">Marketplaces</div>
              </div>
            </div>
          </div>

          <!-- Marketplaces Section -->
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">📦 Marketplaces</h2>
            </div>
            <div class="marketplaces-list" id="marketplaces-list">
              <!-- Marketplaces will be inserted here -->
            </div>
          </div>

          <!-- Plugins Section -->
          <div class="section">
            <div class="section-header">
              <h2 class="section-title">🔌 Installed Plugins</h2>
              <div class="section-controls">
                <div class="search-box">
                  <input
                    type="text"
                    id="plugin-search"
                    placeholder="🔍 Search plugins..."
                    class="search-input"
                  />
                </div>
                <div class="filter-buttons">
                  <button class="filter-btn active" data-status="all">All</button>
                  <button class="filter-btn" data-status="active">Active</button>
                  <button class="filter-btn" data-status="inactive">Inactive</button>
                </div>
              </div>
            </div>
            <div class="plugins-grid" id="plugins-grid">
              <!-- Plugins will be inserted here -->
            </div>
          </div>

          <!-- Empty State -->
          <div class="empty-state" id="plugins-empty-state" style="display: none;">
            <div class="empty-icon">🔌</div>
            <h3>No Plugins Found</h3>
            <p>Install plugins from marketplaces to enhance Claude Code functionality.</p>
          </div>
        </div>

        <!-- Plugin Detail Modal -->
        <div class="modal" id="plugin-modal" style="display: none;">
          <div class="modal-backdrop" id="plugin-modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title" id="plugin-modal-title">Plugin Details</h2>
              <button class="modal-close" id="plugin-modal-close">×</button>
            </div>
            <div class="modal-body" id="plugin-modal-body">
              <!-- Plugin details will be inserted here -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Refresh button
    const refreshBtn = this.container.querySelector('#refresh-plugins');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // Retry button
    const retryBtn = this.container.querySelector('#plugins-retry-load');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.initialize());
    }

    // Search input
    const searchInput = this.container.querySelector('#plugin-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => this.handleFilter(btn.dataset.status, btn));
    });

    // Modal close
    const modalClose = this.container.querySelector('#plugin-modal-close');
    const modalBackdrop = this.container.querySelector('#plugin-modal-backdrop');
    if (modalClose) modalClose.addEventListener('click', () => this.closeModal());
    if (modalBackdrop) modalBackdrop.addEventListener('click', () => this.closeModal());
  }

  /**
   * Update all displays
   */
  updateDisplay() {
    this.updateSummaryCards();
    this.updateMarketplacesList();
    this.updatePluginsGrid();
  }

  /**
   * Update summary cards
   */
  updateSummaryCards() {
    const totalEl = this.container.querySelector('#total-plugins');
    const activeEl = this.container.querySelector('#active-plugins');
    const marketplacesEl = this.container.querySelector('#total-marketplaces');

    if (totalEl) totalEl.textContent = this.summary.totalPlugins || 0;
    if (activeEl) activeEl.textContent = this.summary.activePlugins || 0;
    if (marketplacesEl) marketplacesEl.textContent = this.summary.totalMarketplaces || 0;
  }

  /**
   * Update marketplaces list
   */
  updateMarketplacesList() {
    const list = this.container.querySelector('#marketplaces-list');
    if (!list) return;

    if (!this.marketplaces || this.marketplaces.length === 0) {
      list.innerHTML = '<p class="empty-text">No marketplaces configured.</p>';
      return;
    }

    list.innerHTML = this.marketplaces.map(marketplace => `
      <div class="marketplace-card">
        <div class="marketplace-header">
          <div class="marketplace-name">🏪 ${this.escapeHtml(marketplace.name)}</div>
          <div class="marketplace-status status-${marketplace.status}">
            <span class="status-dot"></span>
            ${marketplace.status}
          </div>
        </div>
        <div class="marketplace-meta">
          ${marketplace.pluginCount} plugins available
        </div>
      </div>
    `).join('');
  }

  /**
   * Update plugins grid
   */
  updatePluginsGrid() {
    const grid = this.container.querySelector('#plugins-grid');
    const emptyState = this.container.querySelector('#plugins-empty-state');

    if (!grid) return;

    // Apply filters
    const filteredPlugins = this.plugins.filter(plugin => {
      // Status filter
      if (this.filterState.status !== 'all' && plugin.status !== this.filterState.status) {
        return false;
      }

      // Search filter
      if (this.filterState.search) {
        const searchLower = this.filterState.search.toLowerCase();
        const nameMatch = plugin.name.toLowerCase().includes(searchLower);
        const descMatch = (plugin.description || '').toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) return false;
      }

      return true;
    });

    if (filteredPlugins.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filteredPlugins.map(plugin => this.renderPluginCard(plugin)).join('');

    // Add click handlers
    grid.querySelectorAll('.plugin-card').forEach(card => {
      card.addEventListener('click', () => {
        const pluginId = card.dataset.id;
        this.openPluginDetails(pluginId);
      });
    });
  }

  /**
   * Render a single plugin card
   */
  renderPluginCard(plugin) {
    const statusClass = plugin.status === 'active' ? 'active' : 'inactive';
    const statusIcon = plugin.status === 'active' ? '✅' : '⚪';

    return `
      <div class="plugin-card" data-id="${plugin.id}">
        <div class="plugin-header">
          <div class="plugin-status status-${statusClass}">
            ${statusIcon} ${plugin.status}
          </div>
        </div>
        <div class="plugin-body">
          <div class="plugin-name">${this.escapeHtml(plugin.name)}</div>
          <div class="plugin-marketplace">📦 ${this.escapeHtml(plugin.marketplace)}</div>
          <div class="plugin-description">${this.escapeHtml(plugin.description || 'No description')}</div>
        </div>
        <div class="plugin-footer">
          <div class="plugin-permissions">
            🔐 ${(plugin.permissions || []).length} permissions
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open plugin details modal
   */
  openPluginDetails(pluginId) {
    const modal = this.container.querySelector('#plugin-modal');
    const modalBody = this.container.querySelector('#plugin-modal-body');
    const modalTitle = this.container.querySelector('#plugin-modal-title');

    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin || !modal) return;

    modalTitle.textContent = plugin.name;
    modalBody.innerHTML = `
      <div class="plugin-details">
        <div class="detail-section">
          <h3>Information</h3>
          <p><strong>Status:</strong> ${plugin.status}</p>
          <p><strong>Marketplace:</strong> ${plugin.marketplace}</p>
          <p><strong>Description:</strong> ${plugin.description || 'N/A'}</p>
        </div>
        <div class="detail-section">
          <h3>Permissions</h3>
          <ul class="permissions-list">
            ${(plugin.permissions || []).map(perm => `<li>🔐 ${this.escapeHtml(perm)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  /**
   * Close the modal
   */
  closeModal() {
    const modal = this.container.querySelector('#plugin-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Handle refresh button click
   */
  async handleRefresh() {
    try {
      this.stateService.setLoading(true);
      await this.loadInitialData();
    } catch (error) {
      console.error('Error refreshing plugins:', error);
      this.showError('Failed to refresh plugins');
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    this.filterState.search = query.toLowerCase().trim();
    this.updatePluginsGrid();
  }

  /**
   * Handle filter button click
   */
  handleFilter(status, button) {
    // Update active button
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Update filter state
    this.filterState.status = status;
    this.updatePluginsGrid();
  }

  /**
   * Start periodic refresh
   */
  startPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.loadInitialData().catch(err => {
        console.error('Error during periodic refresh:', err);
      });
    }, 60000); // Refresh every 60 seconds
  }

  /**
   * Show error message
   */
  showError(message) {
    this.stateService.setError(message);
    const errorEl = this.container.querySelector('#plugins-error');
    if (errorEl) {
      errorEl.style.display = 'flex';
      const errorMsg = errorEl.querySelector('.error-message');
      if (errorMsg) errorMsg.textContent = message;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the page and cleanup
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.container.innerHTML = '';
    this.isInitialized = false;
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginsPage;
}
