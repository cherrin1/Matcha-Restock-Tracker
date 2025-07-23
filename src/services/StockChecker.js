const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const UserAgent = require('user-agents');

class StockChecker {
  constructor(database) {
    this.database = database;
    this.browser = null;
    this.checkInterval = null;
    this.isChecking = false;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      console.log('🌐 Browser initialized');
    }
    return this.browser;
  }

  async checkProduct(productId) {
    try {
      const product = await this.database.getProduct(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      console.log(`🔍 Checking ${product.name}...`);

      // Update status to checking
      await this.database.updateProduct(productId, { 
        status: 'checking'
      });

      let result = await this.checkWithPuppeteer(product.url);
      
      // Fallback to axios if puppeteer fails
      if (!result.success) {
        console.log(`🔄 Puppeteer failed for ${product.name}, trying axios...`);
        result = await this.checkWithAxios(product.url);
      }

      if (result.success) {
        const stockAnalysis = this.analyzeStockStatus(result.html, product.url);
        
        // Update product
        await this.database.updateProduct(productId, {
          status: stockAnalysis.isInStock ? 'in-stock' : 'out-of-stock',
          confidence: stockAnalysis.confidence,
          detected_phrases: stockAnalysis.detectedPhrases
        });

        // Add to check history
        await this.database.addStockCheck(
          productId,
          stockAnalysis.isInStock ? 'in-stock' : 'out-of-stock',
          stockAnalysis.confidence,
          stockAnalysis.detectedPhrases
        );

        console.log(`✅ ${product.name}: ${stockAnalysis.isInStock ? 'IN STOCK' : 'OUT OF STOCK'} (${stockAnalysis.confidence} confidence)`);

        return {
          success: true,
          isInStock: stockAnalysis.isInStock,
          confidence: stockAnalysis.confidence,
          detectedPhrases: stockAnalysis.detectedPhrases
        };
      } else {
        // Update as error
        await this.database.updateProduct(productId, { 
          status: 'error'
        });

        console.log(`❌ Failed to check ${product.name}: ${result.error}`);
        
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error(`Error checking product ${productId}:`, error);
      
      await this.database.updateProduct(productId, { 
        status: 'error'
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkWithPuppeteer(url) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      // Set random user agent
      const userAgent = new UserAgent();
      await page.setUserAgent(userAgent.toString());
      
      // Set viewport
      await page.setViewport({ width: 1366, height: 768 });
      
      // Navigate to page with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);
      
      // Get page content
      const html = await page.content();
      
      await page.close();
      
      return { success: true, html };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkWithAxios(url) {
    try {
      const userAgent = new UserAgent();
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent.toString(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      return { success: true, html: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  analyzeStockStatus(html, url) {
    const $ = cheerio.load(html);
    const text = $.text().toLowerCase();
    
    let confidence = 'low';
    let detectedPhrases = [];
    let isInStock = false;

    // Comprehensive phrase detection
    const outOfStockPhrases = {
      high: [
        'out of stock', 'sold out', 'currently unavailable',
        'temporarily out of stock', 'item is currently sold out',
        'this item is out of stock', 'notify when available',
        'email when available', 'join waitlist', 'add to waitlist',
        '在庫切れ', 'sold out'
      ],
      medium: [
        'unavailable', 'not available', 'temporarily unavailable',
        'out-of-stock', 'soldout', 'no longer available',
        'currently not available', 'notify me when available',
        'back in stock soon', 'coming soon'
      ]
    };

    const inStockPhrases = {
      high: [
        'add to cart', 'add to bag', 'buy now', 'purchase now',
        'order now', 'in stock', 'available now', 'ready to ship',
        'ships today', 'add to basket'
      ],
      medium: [
        'available', 'buy it now', 'shop now', 'get it now',
        'add item', 'select options', 'choose options', 'quick add'
      ]
    };

    // Check for out-of-stock first (higher priority)
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

    // Check for in-stock
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

    // Additional analysis
    if (!isInStock && detectedPhrases.length === 0) {
      // Check for price indicators
      const pricePatterns = [
        /\$\d+\.?\d*/g, /¥\d+/g, /€\d+\.?\d*/g, /£\d+\.?\d*/g
      ];

      let hasPriceIndicator = false;
      for (const pattern of pricePatterns) {
        if (pattern.test(html)) {
          hasPriceIndicator = true;
          detectedPhrases.push('price found');
          break;
        }
      }

      // Check for form elements
      if ($('button[type="submit"]').length > 0 || 
          $('.add-to-cart').length > 0 || 
          $('#add-to-cart').length > 0) {
        detectedPhrases.push('cart button found');
        hasPriceIndicator = true;
      }

      if (hasPriceIndicator) {
        isInStock = true;
        confidence = 'medium';
      } else {
        isInStock = false;
        confidence = 'low';
        detectedPhrases.push('no indicators found');
      }
    }

    return { isInStock, confidence, detectedPhrases };
  }

  async checkAllProducts() {
    if (this.isChecking) {
      console.log('🔄 Already checking products, skipping...');
      return;
    }

    this.isChecking = true;
    console.log('🔍 Starting batch check of all products...');

    try {
      const products = await this.database.getAllProducts();
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`🔍 Checking ${i + 1}/${products.length}: ${product.name}`);
        
        await this.checkProduct(product.id);
        
        // Wait between requests to be respectful
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      console.log('✅ Finished checking all products');
    } catch (error) {
      console.error('❌ Error during batch check:', error);
    }

    this.isChecking = false;
  }

  startPeriodicChecking(intervalMs = 30 * 60 * 1000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`⏰ Starting periodic checking every ${intervalMs / 60000} minutes`);
    
    this.checkInterval = setInterval(() => {
      this.checkAllProducts();
    }, intervalMs);

    // Run initial check after 10 seconds
    setTimeout(() => {
      this.checkAllProducts();
    }, 10000);
  }

  stopPeriodicChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Stopped periodic checking');
    }
  }

  async cleanup() {
    this.stopPeriodicChecking();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🌐 Browser closed');
    }
  }
}

module.exports = StockChecker;
