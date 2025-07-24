import { ProductStorage, Product } from './ProductStorage';

export class MatchaStockService {
  private static checkInterval: ReturnType<typeof setInterval> | null = null;
  private static isChecking = false;

  static async initialize() {
    console.log('🍵 Matcha Stock Checker initialized (Expo Go compatible)');
    this.startPeriodicChecking();
  }

  static startPeriodicChecking(intervalMinutes = 5) { // Changed from 30 to 5 minutes
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`⏰ Starting periodic checking every ${intervalMinutes} minutes`);
    
    // Check immediately after 5 seconds (reduced from 10 seconds)
    setTimeout(() => {
      this.checkAllProducts();
    }, 5000);

    // Then check periodically every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkAllProducts();
    }, intervalMinutes * 60 * 1000);
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
    console.log('🔍 Starting batch stock check...');

    try {
      const products = await ProductStorage.getProducts();
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`Checking ${i + 1}/${products.length}: ${product.name}`);
        
        await this.checkSingleProduct(product);
        
        // Wait 2 seconds between requests to be respectful
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error('Error during batch check:', error);
    }

    this.isChecking = false;
    console.log('✅ Batch check completed');
  }

  // Method to check a newly added product immediately
  static async checkNewProduct(product: Product): Promise<Product> {
    console.log(`🆕 Immediately checking newly added product: ${product.name}`);
    return await this.checkSingleProduct(product);
  }

  static async checkSingleProduct(product: Product): Promise<Product> {
    console.log(`🔍 Starting check for: ${product.name}`);
    
    try {
      const previousStatus = product.status;
      
      // Update status to checking
      const updatedProduct = {
        ...product,
        status: 'checking' as const,
        lastChecked: new Date().toISOString(),
      };
      
      // Update the product in storage
      const products = await ProductStorage.getProducts();
      const index = products.findIndex(p => p.id === updatedProduct.id);
      if (index >= 0) {
        products[index] = updatedProduct;
        await ProductStorage.saveProducts(products);
      }

      console.log(`📡 Fetching URL: ${product.url}`);

      // Try to fetch the product page with timeout
      let html: string;
      
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
        });

        // First try direct fetch (works for many sites)
        const fetchPromise = fetch(product.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
          },
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        html = await response.text();
        console.log(`✅ Direct fetch successful, got ${html.length} characters`);
        
      } catch (directError: any) {
        console.log(`❌ Direct fetch failed: ${directError.message}`);
        console.log('🔄 Trying CORS proxy...');
        
        // Fallback to CORS proxy
        try {
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(product.url)}`;
          const proxyTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Proxy timeout')), 15000); // 15 second timeout for proxy
          });
          
          const proxyFetchPromise = fetch(proxyUrl);
          const proxyResponse = await Promise.race([proxyFetchPromise, proxyTimeoutPromise]);
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy HTTP ${proxyResponse.status}`);
          }
          
          const proxyData = await proxyResponse.json();
          
          if (proxyData && proxyData.contents) {
            html = proxyData.contents;
            console.log(`✅ Proxy fetch successful, got ${html.length} characters`);
          } else {
            throw new Error('No content from proxy');
          }
        } catch (proxyError: any) {
          throw new Error(`Both methods failed. Direct: ${directError.message}, Proxy: ${proxyError.message}`);
        }
      }

      // Analyze stock status
      console.log(`🔬 Analyzing stock status for ${product.name}...`);
      const stockAnalysis = this.analyzeStockStatus(html, product.url);
      console.log(`📊 Analysis result:`, {
        isInStock: stockAnalysis.isInStock,
        confidence: stockAnalysis.confidence,
        detectedPhrases: stockAnalysis.detectedPhrases
      });
      
      const finalProduct = {
        ...product,
        status: stockAnalysis.isInStock ? 'in-stock' as const : 'out-of-stock' as const,
        lastChecked: new Date().toISOString(),
        confidence: stockAnalysis.confidence,
        detectedPhrases: stockAnalysis.detectedPhrases,
      };

      // Log if restocked (no notifications in Expo Go)
      if (previousStatus === 'out-of-stock' && finalProduct.status === 'in-stock') {
        console.log(`🎉 RESTOCK ALERT: ${product.name} from ${product.brand} is back in stock!`);
        // In a development build, you could uncomment this to send notifications:
        // await this.sendRestockNotification(finalProduct);
      }

      // Update the product in storage
      const finalProducts = await ProductStorage.getProducts();
      const finalIndex = finalProducts.findIndex(p => p.id === finalProduct.id);
      if (finalIndex >= 0) {
        finalProducts[finalIndex] = finalProduct;
        await ProductStorage.saveProducts(finalProducts);
      }
      
      console.log(`✅ Successfully checked ${product.name}: ${finalProduct.status}`);
      return finalProduct;

    } catch (error: any) {
      console.error(`💥 Error checking ${product.name}:`, error);
      
      const errorProduct = {
        ...product,
        status: 'error' as const,
        lastChecked: new Date().toISOString(),
        detectedPhrases: [`Error: ${error.message}`],
      };
      
      // Update the product in storage
      const products = await ProductStorage.getProducts();
      const index = products.findIndex(p => p.id === errorProduct.id);
      if (index >= 0) {
        products[index] = errorProduct;
        await ProductStorage.saveProducts(products);
      }
      
      return errorProduct;
    }
  }

  private static analyzeStockStatus(html: string, url: string): {
    isInStock: boolean;
    confidence: 'low' | 'medium' | 'high';
    detectedPhrases: string[];
  } {
    console.log(`🔍 Analyzing HTML content (${html.length} chars) for URL: ${url}`);
    
    const text = html.toLowerCase();
    let confidence: 'low' | 'medium' | 'high' = 'low';
    let detectedPhrases: string[] = [];
    let isInStock = false;

    // Log a sample of the HTML for debugging
    const sample = html.substring(0, 500);
    console.log('📄 HTML sample:', sample);

    // Site-specific checks for common matcha retailers
    if (url.includes('ippodo-tea.co.jp') || url.includes('ippodotea.com')) {
      console.log('🏪 Detected Ippodo site');
      if (text.includes('sold out') || text.includes('完売') || text.includes('品切れ')) {
        console.log('❌ Found Ippodo out of stock indicators');
        return { isInStock: false, confidence: 'high', detectedPhrases: ['ippodo sold out'] };
      }
      if (text.includes('add to cart') || text.includes('カートに入れる') || text.includes('cart')) {
        console.log('✅ Found Ippodo in stock indicators');
        return { isInStock: true, confidence: 'high', detectedPhrases: ['ippodo add to cart'] };
      }
    }

    if (url.includes('amazon.')) {
      console.log('🏪 Detected Amazon site');
      if (text.includes('currently unavailable') || text.includes('out of stock') || text.includes('temporarily out of stock')) {
        console.log('❌ Found Amazon out of stock indicators');
        return { isInStock: false, confidence: 'high', detectedPhrases: ['amazon out of stock'] };
      }
      if (text.includes('add to cart') || text.includes('buy now') || text.includes('add to basket')) {
        console.log('✅ Found Amazon in stock indicators');
        return { isInStock: true, confidence: 'high', detectedPhrases: ['amazon add to cart'] };
      }
    }

    if (url.includes('encha.com')) {
      console.log('🏪 Detected Encha site');
      if (text.includes('sold out') || text.includes('notify me when available')) {
        console.log('❌ Found Encha out of stock indicators');
        return { isInStock: false, confidence: 'high', detectedPhrases: ['encha sold out'] };
      }
      if (text.includes('add to cart')) {
        console.log('✅ Found Encha in stock indicators');
        return { isInStock: true, confidence: 'high', detectedPhrases: ['encha add to cart'] };
      }
    }

    // Generic out of stock phrases (high confidence)
    const outOfStockHighConf = [
      'out of stock', 'sold out', 'currently unavailable', 'not available',
      'temporarily out of stock', 'notify when available', 'email when available',
      'join waitlist', 'add to waitlist', 'back in stock notification',
      'no longer available', 'discontinued', 'notify me when available',
      'out-of-stock', 'soldout'
    ];

    for (const phrase of outOfStockHighConf) {
      if (text.includes(phrase)) {
        console.log(`❌ Found out of stock phrase: "${phrase}"`);
        detectedPhrases.push(phrase);
        return { isInStock: false, confidence: 'high', detectedPhrases };
      }
    }

    // Generic in stock phrases (high confidence)
    const inStockHighConf = [
      'add to cart', 'add to bag', 'buy now', 'purchase now',
      'in stock', 'available now', 'ready to ship', 'ships today',
      'add item', 'buy it now', 'order now', 'add to basket',
      'shop now', 'purchase', 'buy', 'cart'
    ];

    for (const phrase of inStockHighConf) {
      if (text.includes(phrase)) {
        console.log(`✅ Found in stock phrase: "${phrase}"`);
        detectedPhrases.push(phrase);
        return { isInStock: true, confidence: 'high', detectedPhrases };
      }
    }

    // Medium confidence checks
    const outOfStockMedConf = ['unavailable', 'coming soon', 'pre-order', 'backorder'];
    const inStockMedConf = ['available', 'select options', 'choose size', 'select quantity'];

    for (const phrase of outOfStockMedConf) {
      if (text.includes(phrase)) {
        console.log(`⚠️ Found medium confidence out of stock phrase: "${phrase}"`);
        detectedPhrases.push(phrase);
        return { isInStock: false, confidence: 'medium', detectedPhrases };
      }
    }

    for (const phrase of inStockMedConf) {
      if (text.includes(phrase)) {
        console.log(`✅ Found medium confidence in stock phrase: "${phrase}"`);
        detectedPhrases.push(phrase);
        return { isInStock: true, confidence: 'medium', detectedPhrases };
      }
    }

    // Price-based detection (medium confidence)
    const priceRegex = /\$\d+\.?\d*|\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|¥\d+|€\d+|£\d+/g;
    const prices = html.match(priceRegex);
    if (prices && prices.length > 0) {
      console.log(`💰 Found prices: ${prices.slice(0, 3).join(', ')}`);
      detectedPhrases.push(`price found: ${prices[0]}`);
      isInStock = true;
      confidence = 'medium';
    }

    // Check for form elements that might indicate stock
    if (text.includes('<form') && (text.includes('quantity') || text.includes('qty'))) {
      console.log('📝 Found quantity form - likely in stock');
      detectedPhrases.push('quantity form found');
      isInStock = true;
      confidence = 'medium';
    }

    // Fallback: if no clear indicators, assume out of stock (safer)
    if (detectedPhrases.length === 0) {
      console.log('❓ No clear indicators found - defaulting to out of stock');
      detectedPhrases.push('no clear indicators');
      isInStock = false;
      confidence = 'low';
    }

    console.log(`📊 Final analysis: ${isInStock ? 'IN STOCK' : 'OUT OF STOCK'} (${confidence} confidence)`);
    return { isInStock, confidence, detectedPhrases };
  }

  static async getStats() {
    const products = await ProductStorage.getProducts();
    return {
      total: products.length,
      inStock: products.filter(p => p.status === 'in-stock').length,
      outOfStock: products.filter(p => p.status === 'out-of-stock').length,
      checking: products.filter(p => p.status === 'checking').length,
      errors: products.filter(p => p.status === 'error').length,
    };
  }

  // Expose the checking status
  static get isCurrentlyChecking(): boolean {
    return this.isChecking;
  }
}