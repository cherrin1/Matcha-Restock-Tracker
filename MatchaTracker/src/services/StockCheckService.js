import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import axios from 'axios';

export class StockCheckService {
  static checkInterval = null;
  static isChecking = false;

  static initialize() {
    console.log('📱 Stock checking service initialized');
    this.startPeriodicChecking();
  }

  static startPeriodicChecking(intervalMinutes = 60) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`⏰ Starting periodic checking every ${intervalMinutes} minutes`);
    
    this.checkInterval = setInterval(() => {
      this.checkAllProducts();
    }, intervalMinutes * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkAllProducts();
    }, 30000);
  }

  static stopPeriodicChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  static async checkAllProducts() {
    if (this.isChecking) {
      console.log('Already checking products...');
      return;
    }

    this.isChecking = true;
    console.log('🔍 Starting batch check...');

    try {
      const products = await this.getProducts();
      
      for (let i = 0; i < products.length; i++) {
        console.log(`Checking ${i + 1}/${products.length}: ${products[i].name}`);
        await this.checkSingleProduct(products[i]);
        
        // Wait between requests
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (error) {
      console.error('Error during batch check:', error);
    }

    this.isChecking = false;
    console.log('✅ Batch check completed');
  }

  static async checkSingleProduct(product) {
    try {
      const previousStatus = product.status;
      
      // Update status to checking
      product.status = 'checking';
      product.lastChecked = new Date().toISOString();
      await this.saveProduct(product);

      // Use a CORS proxy for web requests
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(product.url)}`;
      
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
      });

      let html;
      if (response.data && response.data.contents) {
        html = response.data.contents;
      } else {
        throw new Error('No content received');
      }

      const stockAnalysis = this.analyzeStockStatus(html);
      
      product.status = stockAnalysis.isInStock ? 'in-stock' : 'out-of-stock';
      product.confidence = stockAnalysis.confidence;
      product.detectedPhrases = stockAnalysis.detectedPhrases;
      product.lastChecked = new Date().toISOString();

      // Send notification if restocked
      if (previousStatus === 'out-of-stock' && product.status === 'in-stock') {
        this.sendRestockNotification(product);
      }

      await this.saveProduct(product);
      return product;

    } catch (error) {
      console.error(`Error checking ${product.name}:`, error);
      product.status = 'error';
      product.lastChecked = new Date().toISOString();
      await this.saveProduct(product);
      return product;
    }
  }

  static analyzeStockStatus(html) {
    const text = html.toLowerCase();
    
    let confidence = 'low';
    let detectedPhrases = [];
    let isInStock = false;

    // Out of stock phrases
    const outOfStockPhrases = {
      high: [
        'out of stock', 'sold out', 'currently unavailable',
        'temporarily out of stock', 'notify when available',
        'email when available', 'join waitlist', 'add to waitlist'
      ],
      medium: [
        'unavailable', 'not available', 'out-of-stock',
        'soldout', 'no longer available', 'coming soon'
      ]
    };

    // In stock phrases
    const inStockPhrases = {
      high: [
        'add to cart', 'add to bag', 'buy now',
        'purchase now', 'in stock', 'available now',
        'ready to ship', 'ships today'
      ],
      medium: [
        'available', 'buy it now', 'shop now',
        'add item', 'select options', 'choose options'
      ]
    };

    // Check out of stock first (higher priority)
    for (const [conf, phrases] of Object.entries(outOfStockPhrases)) {
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          detectedPhrases.push(phrase);
          confidence = conf;
          isInStock = false;
          return { isInStock, confidence, detectedPhrases };
        }
      }
    }

    // Check in stock
    for (const [conf, phrases] of Object.entries(inStockPhrases)) {
      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          detectedPhrases.push(phrase);
          confidence = conf;
          isInStock = true;
          break;
        }
      }
      if (isInStock) break;
    }

    // Fallback analysis
    if (!isInStock && detectedPhrases.length === 0) {
      // Check for price indicators
      const pricePattern = /\$\d+\.?\d*/g;
      if (pricePattern.test(html)) {
        detectedPhrases.push('price found');
        isInStock = true;
        confidence = 'medium';
      } else {
        detectedPhrases.push('no indicators');
        isInStock = false;
        confidence = 'low';
      }
    }

    return { isInStock, confidence, detectedPhrases };
  }

  static async sendRestockNotification(product) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Matcha Restock Alert! 🍵',
        body: `${product.name} from ${product.brand} is back in stock!`,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  }

  // Storage methods
  static async getProducts() {
    try {
      const data = await AsyncStorage.getItem('matcha_products');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading products:', error);
      return [];
    }
  }

  static async saveProduct(product) {
    try {
      const products = await this.getProducts();
      const index = products.findIndex(p => p.id === product.id);
      
      if (index >= 0) {
        products[index] = product;
      } else {
        products.push(product);
      }
      
      await AsyncStorage.setItem('matcha_products', JSON.stringify(products));
    } catch (error) {
      console.error('Error saving product:', error);
    }
  }

  static async addProduct(name, brand, url) {
    const product = {
      id: Date.now().toString(),
      name,
      brand,
      url,
      status: 'checking',
      createdAt: new Date().toISOString(),
    };

    await this.saveProduct(product);
    
    // Check immediately
    setTimeout(() => {
      this.checkSingleProduct(product);
    }, 1000);

    return product;
  }

  static async deleteProduct(productId) {
    try {
      const products = await this.getProducts();
      const filtered = products.filter(p => p.id !== productId);
      await AsyncStorage.setItem('matcha_products', JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }

  static async getStats() {
    const products = await this.getProducts();
    return {
      total: products.length,
      inStock: products.filter(p => p.status === 'in-stock').length,
      outOfStock: products.filter(p => p.status === 'out-of-stock').length,
      errors: products.filter(p => p.status === 'error').length,
    };
  }
}