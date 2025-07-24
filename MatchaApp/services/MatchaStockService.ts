import * as Notifications from 'expo-notifications';
import { ProductStorage, Product } from './ProductStorage';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class MatchaStockService {
  private static checkInterval: ReturnType<typeof setInterval> | null = null;
  private static isChecking = false;

  static async initialize() {
    console.log('🍵 Matcha Stock Checker initialized with notifications');
    await this.requestNotificationPermissions();
    this.startPeriodicChecking();
  }

  private static async requestNotificationPermissions() {
    try {
      console.log('📱 Requesting notification permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      console.log('📱 Current permission status:', existingStatus);
      
      if (existingStatus !== 'granted') {
        console.log('📱 Requesting permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('📱 New permission status:', status);
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Push notification permissions not granted');
        console.log('💡 You can enable notifications in device settings');
      } else {
        console.log('✅ Push notification permissions granted!');
        
        // Test notification to confirm it works
        await this.sendTestNotification();
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
    }
  }

  private static async sendTestNotification() {
    try {
      console.log('🧪 Sending test notification...');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🍵 Matcha Tracker Ready!',
          body: 'Your matcha restock tracker is now active and will notify you when products come back in stock.',
          sound: true,
          data: { test: true },
        },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2 
        },
      });
      console.log('✅ Test notification scheduled');
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
    }
  }

  static startPeriodicChecking(intervalMinutes = 30) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`⏰ Starting periodic checking every ${intervalMinutes} minutes`);
    
    // Check immediately after 10 seconds
    setTimeout(() => {
      this.checkAllProducts();
    }, 10000);

    // Then check periodically
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

  // Fetch with multiple proxy fallbacks for better reliability
  private static async fetchWithProxyFallback(url: string): Promise<string> {
    const proxies = [
      {
        name: 'AllOrigins',
        getUrl: (targetUrl: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        extractContent: (data: any) => data?.contents,
        isJSON: true
      },
      {
        name: 'CORS.sh',
        getUrl: (targetUrl: string) => `https://cors.sh/${targetUrl}`,
        extractContent: (data: any) => data,
        isJSON: false
      },
      {
        name: 'ThingProxy',
        getUrl: (targetUrl: string) => `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
        extractContent: (data: any) => data,
        isJSON: false
      },
      {
        name: 'Proxy6',
        getUrl: (targetUrl: string) => `https://api.proxify.io/?url=${encodeURIComponent(targetUrl)}`,
        extractContent: (data: any) => data?.data || data,
        isJSON: true
      }
    ];

    for (let i = 0; i < proxies.length; i++) {
      const proxy = proxies[i];
      try {
        console.log(`🌐 Trying proxy ${i + 1}/${proxies.length}: ${proxy.name}`);
        const proxyUrl = proxy.getUrl(url);
        console.log(`🔗 Proxy URL: ${proxyUrl}`);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.log(`⏰ ${proxy.name} request timed out after 20 seconds`);
            reject(new Error(`${proxy.name} timeout after 20 seconds`));
          }, 20000);
        });

        const fetchPromise = fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          }
        });

        console.log(`⏳ Waiting for ${proxy.name} response...`);
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        console.log(`📊 ${proxy.name} response: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          console.log(`❌ ${proxy.name} failed with status ${response.status}`);
          continue; // Try next proxy
        }

        console.log(`📥 Parsing ${proxy.name} response...`);
        
        // Handle different response types
        let responseData: any;
        let html: string;
        
        try {
          if (proxy.isJSON) {
            responseData = await response.json();
            html = proxy.extractContent(responseData);
          } else {
            html = await response.text();
          }
        } catch (parseError: any) {
          console.log(`❌ ${proxy.name} parsing failed:`, parseError.message);
          continue; // Try next proxy
        }
        
        if (!html || typeof html !== 'string' || html.length < 100) {
          console.log(`❌ ${proxy.name} returned invalid content:`, { 
            type: typeof html, 
            length: html?.length || 0,
            preview: typeof html === 'string' ? html.substring(0, 100) : 'Not a string'
          });
          continue; // Try next proxy
        }

        console.log(`✅ ${proxy.name} success! Got HTML content: ${html.length} characters`);
        console.log(`📄 First 200 chars: ${html.substring(0, 200)}`);
        return html;

      } catch (error: any) {
        console.error(`❌ ${proxy.name} error:`, error.message);
        if (i === proxies.length - 1) {
          // Last proxy failed, throw the error
          throw new Error(`All proxy services failed. Last error from ${proxy.name}: ${error.message}`);
        }
        // Continue to next proxy
        continue;
      }
    }

    // This should never be reached due to the throw in the catch block above
    throw new Error('All proxy services failed');
  }

  static async checkSingleProduct(product: Product): Promise<Product> {
    console.log(`🔍 [${new Date().toLocaleTimeString()}] Starting check for: ${product.name}`);
    console.log(`📍 URL: ${product.url}`);
    
    try {
      const previousStatus = product.status;
      
      // Update status to checking
      const updatedProduct = {
        ...product,
        status: 'checking' as const,
        lastChecked: new Date().toISOString(),
      };
      
      console.log(`💾 Updating product status to 'checking'...`);
      
      // Update the product in storage
      const products = await ProductStorage.getProducts();
      const index = products.findIndex(p => p.id === updatedProduct.id);
      if (index >= 0) {
        products[index] = updatedProduct;
        await ProductStorage.saveProducts(products);
        console.log(`✅ Status updated in storage`);
      } else {
        console.log(`❌ Product not found in storage!`);
      }

      console.log(`📡 Starting network request with fallback proxies...`);

      // Use the new proxy fallback system
      const html = await this.fetchWithProxyFallback(product.url);

      // Analyze stock status
      console.log(`🔬 Starting stock analysis...`);
      const stockAnalysis = this.analyzeStockStatus(html, product.url);
      console.log(`📊 Analysis complete:`, stockAnalysis);
      
      const finalProduct = {
        ...product,
        status: stockAnalysis.isInStock ? 'in-stock' as const : 'out-of-stock' as const,
        lastChecked: new Date().toISOString(),
        confidence: stockAnalysis.confidence,
        detectedPhrases: stockAnalysis.detectedPhrases,
      };

      // Check if restocked and send notification
      if (previousStatus === 'out-of-stock' && finalProduct.status === 'in-stock') {
        console.log(`🎉 RESTOCK ALERT: ${product.name} from ${product.brand} is back in stock!`);
        await this.sendRestockNotification(finalProduct);
      }

      console.log(`💾 Saving final result: ${finalProduct.status}`);
      
      // Update the product in storage
      const finalProducts = await ProductStorage.getProducts();
      const finalIndex = finalProducts.findIndex(p => p.id === finalProduct.id);
      if (finalIndex >= 0) {
        finalProducts[finalIndex] = finalProduct;
        await ProductStorage.saveProducts(finalProducts);
        console.log(`✅ Final status saved to storage`);
      }
      
      console.log(`✅ [${new Date().toLocaleTimeString()}] Successfully completed check for ${product.name}: ${finalProduct.status}`);
      return finalProduct;

    } catch (error: any) {
      console.error(`💥 [${new Date().toLocaleTimeString()}] Error checking ${product.name}:`, error);
      console.error(`🔍 Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      const errorProduct = {
        ...product,
        status: 'error' as const,
        lastChecked: new Date().toISOString(),
        detectedPhrases: [`Error: ${error.message}`],
      };
      
      console.log(`💾 Saving error status...`);
      
      // Update the product in storage
      const products = await ProductStorage.getProducts();
      const index = products.findIndex(p => p.id === errorProduct.id);
      if (index >= 0) {
        products[index] = errorProduct;
        await ProductStorage.saveProducts(products);
        console.log(`✅ Error status saved`);
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

  private static async sendRestockNotification(product: Product) {
    try {
      console.log(`📱 Sending restock notification for ${product.name}...`);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🍵 Matcha Restock Alert!',
          body: `${product.name} from ${product.brand} is back in stock!`,
          sound: true,
          data: { 
            productId: product.id, 
            url: product.url,
            productName: product.name,
            brand: product.brand
          },
        },
        trigger: null, // Send immediately
      });
      
      console.log(`✅ Restock notification sent for ${product.name}`);
      
    } catch (error) {
      console.error('❌ Error sending restock notification:', error);
    }
  }

  // Manual notification test method
  static async sendManualTestNotification() {
    try {
      console.log('🧪 Sending manual test notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: 'This is a test to check if notifications are working properly.',
          sound: true,
          data: { test: true, timestamp: Date.now() },
        },
        trigger: { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1 
        },
      });
      
      console.log('✅ Manual test notification sent');
      return true;
      
    } catch (error) {
      console.error('❌ Error sending manual test notification:', error);
      return false;
    }
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