const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const StockChecker = require('./src/services/StockChecker');
const Database = require('./src/services/Database');
const NotificationService = require('./src/services/NotificationService');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for our app
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize services
let database;
let stockChecker;
let notificationService;

async function initializeServices() {
  try {
    database = new Database();
    await database.initialize();
    
    stockChecker = new StockChecker(database);
    notificationService = new NotificationService();
    
    // Start periodic checking (every 30 minutes)
    stockChecker.startPeriodicChecking(30 * 60 * 1000);
    
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing services:', error);
    process.exit(1);
  }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('📱 New client connected');
  
  ws.on('close', () => {
    console.log('📱 Client disconnected');
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// API Routes

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await database.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, brand, url } = req.body;
    
    if (!name || !brand || !url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const productId = await database.addProduct(name, brand, url);
    const product = await database.getProduct(productId);
    
    // Check stock immediately
    stockChecker.checkProduct(productId).then(() => {
      // Broadcast update to all clients
      database.getProduct(productId).then(updatedProduct => {
        broadcastUpdate({
          type: 'productUpdated',
          product: updatedProduct
        });
      });
    });
    
    res.json(product);
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    await database.updateProduct(id, updates);
    const product = await database.getProduct(id);
    
    broadcastUpdate({
      type: 'productUpdated',
      product: product
    });
    
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await database.deleteProduct(id);
    
    broadcastUpdate({
      type: 'productDeleted',
      productId: id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Check single product
app.post('/api/products/:id/check', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await stockChecker.checkProduct(id);
    
    const product = await database.getProduct(id);
    broadcastUpdate({
      type: 'productUpdated',
      product: product
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error checking product:', error);
    res.status(500).json({ error: 'Failed to check product' });
  }
});

// Check all products
app.post('/api/products/check-all', async (req, res) => {
  try {
    await stockChecker.checkAllProducts();
    res.json({ success: true });
  } catch (error) {
    console.error('Error checking all products:', error);
    res.status(500).json({ error: 'Failed to check all products' });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await database.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Matcha Restock Tracker running on http://localhost:${PORT}`);
  console.log(`📱 Access from your phone: http://[YOUR_COMPUTER_IP]:${PORT}`);
  console.log('🔍 Initializing services...');
  
  await initializeServices();
  
  // Get local IP address
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`📱 Phone access URL: http://${interface.address}:${PORT}`);
      }
    }
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (stockChecker) {
    stockChecker.stopPeriodicChecking();
  }
  
  if (database) {
    await database.close();
  }
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
