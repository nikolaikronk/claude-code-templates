/**
 * AgentsPage - Conversations and chat history page
 * Displays all Claude Code conversations with ability to view messages
 */
class AgentsPage {
  constructor(container, services) {
    this.container = container;
    this.dataService = services.data;
    this.stateService = services.state;

    this.conversations = [];
    this.conversationStates = {};
    this.selectedConversation = null;
    this.isInitialized = false;
    this.refreshInterval = null;

    // Subscribe to state changes
    this.unsubscribe = this.stateService.subscribe(this.handleStateChange.bind(this));
  }

  /**
   * Initialize the agents page
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('💬 Initializing AgentsPage...');

    try {
      await this.render();
      this.stateService.setLoading(true);
      await this.loadInitialData();
      this.bindEvents();
      this.startPeriodicRefresh();
      this.isInitialized = true;
      console.log('✅ AgentsPage fully initialized!');
    } catch (error) {
      console.error('❌ Error during agents page initialization:', error);
      this.showError('Failed to load conversations');
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Handle state changes from StateService
   */
  handleStateChange(state, action) {
    switch (action) {
      case 'update_conversations':
        this.conversations = state.conversations || [];
        this.conversationStates = state.conversationStates || {};
        this.updateConversationsList();
        break;
      case 'set_loading':
        this.updateLoadingState(state.isLoading);
        break;
      case 'set_error':
        this.updateErrorState(state.error);
        break;
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      const [conversationsData, statesData] = await Promise.all([
        this.dataService.getConversations(),
        this.dataService.getConversationStates()
      ]);

      this.conversations = conversationsData.conversations || [];
      this.conversationStates = statesData.states || {};

      this.updateConversationsList();
    } catch (error) {
      console.error('Error loading conversations:', error);
      throw error;
    }
  }

  /**
   * Render the agents page structure
   */
  async render() {
    this.container.innerHTML = `
      <div class="agents-page">
        <!-- Header -->
        <div class="page-header">
          <div class="page-title-section">
            <h1 class="page-title">💬 Conversations</h1>
            <p class="page-subtitle">View and manage your Claude Code conversations</p>
          </div>
          <div class="page-actions">
            <button class="action-btn-small" id="refresh-conversations" title="Refresh conversations">
              <span class="btn-icon-small">🔄</span>
              Refresh
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-state" id="agents-loading" style="display: none;">
          <div class="loading-spinner"></div>
          <span class="loading-text">Loading conversations...</span>
        </div>

        <!-- Error State -->
        <div class="error-state" id="agents-error" style="display: none;">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-message"></span>
            <button class="error-retry" id="agents-retry-load">Retry</button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="agents-content" id="agents-content">
          <!-- Filters -->
          <div class="filters-section">
            <div class="search-box">
              <input
                type="text"
                id="conversation-search"
                placeholder="🔍 Search conversations..."
                class="search-input"
              />
            </div>
            <div class="filter-buttons">
              <button class="filter-btn active" data-filter="all">All</button>
              <button class="filter-btn" data-filter="active">Active</button>
              <button class="filter-btn" data-filter="recent">Recent</button>
            </div>
          </div>

          <!-- Conversations Grid -->
          <div class="conversations-grid" id="conversations-grid">
            <!-- Conversations will be inserted here -->
          </div>

          <!-- Empty State -->
          <div class="empty-state" id="empty-state" style="display: none;">
            <div class="empty-icon">💭</div>
            <h3>No Conversations Found</h3>
            <p>Start using Claude Code to see your conversations here.</p>
          </div>
        </div>

        <!-- Conversation Detail Modal -->
        <div class="modal" id="conversation-modal" style="display: none;">
          <div class="modal-backdrop" id="modal-backdrop"></div>
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title" id="modal-title">Conversation Details</h2>
              <button class="modal-close" id="modal-close">×</button>
            </div>
            <div class="modal-body" id="modal-body">
              <div class="loading-spinner"></div>
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
    const refreshBtn = this.container.querySelector('#refresh-conversations');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // Retry button
    const retryBtn = this.container.querySelector('#agents-retry-load');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.initialize());
    }

    // Search input
    const searchInput = this.container.querySelector('#conversation-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => this.handleFilter(btn.dataset.filter, btn));
    });

    // Modal close
    const modalClose = this.container.querySelector('#modal-close');
    const modalBackdrop = this.container.querySelector('#modal-backdrop');
    if (modalClose) modalClose.addEventListener('click', () => this.closeModal());
    if (modalBackdrop) modalBackdrop.addEventListener('click', () => this.closeModal());
  }

  /**
   * Update conversations list display
   */
  updateConversationsList() {
    const grid = this.container.querySelector('#conversations-grid');
    const emptyState = this.container.querySelector('#empty-state');

    if (!grid) return;

    if (!this.conversations || this.conversations.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = this.conversations.map(conv => this.renderConversationCard(conv)).join('');

    // Add click handlers to cards
    grid.querySelectorAll('.conversation-card').forEach(card => {
      card.addEventListener('click', () => {
        const convId = card.dataset.id;
        this.openConversation(convId);
      });
    });
  }

  /**
   * Render a single conversation card
   */
  renderConversationCard(conversation) {
    const state = this.conversationStates[conversation.id] || {};
    const isActive = state.status === 'active';
    const lastMessage = conversation.lastMessage || 'No messages';
    const messageCount = conversation.messageCount || 0;
    const project = conversation.project || 'Unknown';
    const timeAgo = this.getTimeAgo(conversation.lastActivity || conversation.timestamp);

    return `
      <div class="conversation-card" data-id="${conversation.id}">
        <div class="card-header">
          <div class="card-status ${isActive ? 'active' : 'inactive'}">
            <span class="status-dot"></span>
            ${isActive ? 'Active' : 'Inactive'}
          </div>
          <div class="card-time">${timeAgo}</div>
        </div>
        <div class="card-body">
          <div class="card-project">📁 ${this.escapeHtml(project)}</div>
          <div class="card-preview">${this.escapeHtml(lastMessage.substring(0, 100))}${lastMessage.length > 100 ? '...' : ''}</div>
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span class="meta-item">💬 ${messageCount} messages</span>
            <span class="meta-item">🔧 ${conversation.toolCalls || 0} tools</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open conversation detail modal
   */
  async openConversation(conversationId) {
    const modal = this.container.querySelector('#conversation-modal');
    const modalBody = this.container.querySelector('#modal-body');
    const modalTitle = this.container.querySelector('#modal-title');

    if (!modal) return;

    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="loading-spinner"></div><p>Loading conversation...</p>';

    try {
      const messages = await this.dataService.getConversationMessages(conversationId);
      const conversation = this.conversations.find(c => c.id === conversationId);

      if (conversation) {
        modalTitle.textContent = `📁 ${conversation.project || 'Conversation'}`;
      }

      if (messages && messages.length > 0) {
        modalBody.innerHTML = `
          <div class="messages-container">
            ${messages.map(msg => this.renderMessage(msg)).join('')}
          </div>
        `;
      } else {
        modalBody.innerHTML = '<p class="empty-messages">No messages found in this conversation.</p>';
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      modalBody.innerHTML = '<p class="error-text">Failed to load messages. Please try again.</p>';
    }
  }

  /**
   * Render a single message
   */
  renderMessage(message) {
    const role = message.role || 'unknown';
    const content = message.content || '';
    const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : '';

    return `
      <div class="message message-${role}">
        <div class="message-header">
          <span class="message-role">${role === 'user' ? '👤 User' : '🤖 Assistant'}</span>
          <span class="message-time">${timestamp}</span>
        </div>
        <div class="message-content">
          ${this.escapeHtml(content)}
        </div>
      </div>
    `;
  }

  /**
   * Close the modal
   */
  closeModal() {
    const modal = this.container.querySelector('#conversation-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Handle refresh button click
   */
  async handleRefresh() {
    try {
      this.stateService.setLoading(true);
      await this.loadInitialData();
    } catch (error) {
      console.error('Error refreshing conversations:', error);
      this.showError('Failed to refresh conversations');
    } finally {
      this.stateService.setLoading(false);
    }
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    const cards = this.container.querySelectorAll('.conversation-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
  }

  /**
   * Handle filter button click
   */
  handleFilter(filter, button) {
    // Update active button
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Filter conversations
    const cards = this.container.querySelectorAll('.conversation-card');
    cards.forEach(card => {
      const convId = card.dataset.id;
      const state = this.conversationStates[convId] || {};

      let show = true;
      if (filter === 'active') {
        show = state.status === 'active';
      } else if (filter === 'recent') {
        const conv = this.conversations.find(c => c.id === convId);
        const lastActivity = new Date(conv?.lastActivity || 0);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        show = lastActivity > oneDayAgo;
      }

      card.style.display = show ? '' : 'none';
    });
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
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Update loading state
   */
  updateLoadingState(isLoading) {
    const loadingEl = this.container.querySelector('#agents-loading');
    const contentEl = this.container.querySelector('#agents-content');

    if (loadingEl) loadingEl.style.display = isLoading ? 'flex' : 'none';
    if (contentEl) contentEl.style.display = isLoading ? 'none' : 'block';
  }

  /**
   * Update error state
   */
  updateErrorState(error) {
    const errorEl = this.container.querySelector('#agents-error');
    if (errorEl && error) {
      errorEl.style.display = 'flex';
      const errorMsg = errorEl.querySelector('.error-message');
      if (errorMsg) errorMsg.textContent = error;
    } else if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.stateService.setError(message);
  }

  /**
   * Get relative time string
   */
  getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';

    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
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
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
    this.isInitialized = false;
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentsPage;
}
