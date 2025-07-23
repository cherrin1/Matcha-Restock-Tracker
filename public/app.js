class MatchaTracker {
    constructor() {
        this.ws = null;
        this.products = [];
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.loadProducts();
        this.loadStats();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
            // Reconnect after 3 seconds
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'productUpdated':
                this.updateProduct(data.product);
                break;
            case 'productDeleted':
                this.removeProduct(data.productId);
                break;
        }
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (connected) {
            status.textContent = '🟢 Connected';
            status.className = 'connection-status connected';
        } else {
            status.textContent = '🔴 Disconnected';
            status.className = 'connection-status disconnected';
        }
    }

    setupEventListeners() {
        document.getElementById('addProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProduct();
        });
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            this.products = await response.json();
            this.renderProducts();
        } catch (error) {
            console.error('Error loading products:', error);
            this.showNotification('Error loading products', 'error');
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            this.updateStats(stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async addProduct() {
        const name = document.getElementById('productName').value.trim();
        const brand = document.getElementById('productBrand').value;
        const url = document.getElementById('productUrl').value.trim();

        if (!name || !brand || !url) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, brand, url })
            });

            if (response.ok) {
                const product = await response.json();
                this.products.push(product);
                this.renderProducts();
                this.loadStats();
                
                // Clear form
                document.getElementById('addProductForm').reset();
                
                this.showNotification('Product added successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error adding product', 'error');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            this.showNotification('Error adding product', 'error');
        }
    }

    async checkProduct(productId) {
        try {
            const response = await fetch(`/api/products/${productId}/check`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Stock check started', 'info');
            } else {
                this.showNotification('Error starting stock check', 'error');
            }
        } catch (error) {
            console.error('Error checking product:', error);
            this.showNotification('Error checking product', 'error');
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.removeProduct(productId);
                this.loadStats();
                this.showNotification('Product deleted', 'info');
            } else {
                this.showNotification('Error deleting product', 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            this.showNotification('Error deleting product', 'error');
        }
    }

    updateProduct(product) {
        const index = this.products.findIndex(p => p.id === product.id);
        if (index !== -1) {
            this.products[index] = product;
            this.renderProducts();
            this.loadStats();
        }
    }

    removeProduct(productId) {
        this.products = this.products.filter(p => p.id != productId);
        this.renderProducts();
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        
        if (this.products.length === 0) {
            grid.innerHTML = '<div class="loading">No products tracked yet. Add your first product above!</div>';
            return;
        }

        grid.innerHTML = this.products.map(product => this.createProductCard(product)).join('');
    }

    createProductCard(product) {
        const statusText = {
            'in-stock': 'In Stock',
            'out-of-stock': 'Out of Stock',
            'checking': 'Checking...',
            'error': 'Check Failed'
        };

        const confidenceBadge = product.confidence ? 
            `<div class="confidence-badge confidence-${product.confidence}">${product.confidence.toUpperCase()}</div>` : '';

        const detectedPhrases = product.detected_phrases && product.detected_phrases.length > 0 ?
            `<div class="detected-phrases">Detected: ${JSON.parse(product.detected_phrases).slice(0, 3).join(', ')}</div>` : '';

        const lastChecked = product.last_checked ? 
            new Date(product.last_checked).toLocaleString() : 'Never';

        return `
            <div class="product-card ${product.status}">
                ${confidenceBadge}
                <div class="product-title">${product.name}</div>
                <div class="product-brand">${product.brand}</div>
                <div class="status-badge ${product.status}">${statusText[product.status]}</div>
                <a href="${product.url}" target="_blank" class="product-url">${product.url}</a>
                ${detectedPhrases}
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 10px;">
                    Last checked: ${lastChecked}
                    ${product.check_count ? ` (${product.check_count} checks)` : ''}
                </div>
                <div class="product-actions">
                    <button class="btn-small btn-check" onclick="app.checkProduct(${product.id})" 
                            ${product.status === 'checking' ? 'disabled' : ''}>
                        Check Now
                    </button>
                    <button class="btn-small btn-delete" onclick="app.deleteProduct(${product.id})">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    updateStats(stats) {
        document.getElementById('totalProducts').textContent = stats.total || 0;
        document.getElementById('inStockCount').textContent = stats.in_stock || 0;
        document.getElementById('outOfStockCount').textContent = stats.out_of_stock || 0;
        document.getElementById('errorCount').textContent = stats.errors || 0;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
}

// Initialize the app
const app = new MatchaTracker();
