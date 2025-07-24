import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { ProductStorage, Product } from './ProductStorage';

const BACKGROUND_FETCH_TASK = 'background-stock-check';

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

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('🔍 Background stock check started...');
    
    const products = await ProductStorage.getProducts();
    let hasRestocks = false;
    
    for (const product of products) {
      const previousStatus = product.status;
      const updatedProduct = await MatchaStockService.checkSingleProduct(product);
      
      // Check for restocks
      if (previousStatus === 'out-of-stock' && updatedProduct.status === 'in-stock') {
        hasRestocks = true;
        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🍵 Matcha Restock!',
            body: `${product.name} from ${product.brand} is back in stock!`,
            data: { productId: product.id, url: product.url },
          },
          trigger: null,
        });
      }
    }
    
    console.log(`✅ Background check completed. Restocks found: ${hasRestocks}`);
    
    return hasRestocks 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
      
  } catch (error) {
    console.error('❌ Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export class MatchaStockService {
  private static isRegistered = false;

  static async initialize() {
    console.log('🍵 Initializing Matcha Stock Checker with background processing...');
    
    // Request notification permissions
    await this.requestPermissions();
    
    // Register background fetch
    await this.registerBackgroundFetch();
    
    // Do an initial check
    setTimeout(() => {
      this.checkAllProducts();
    }, 5000);
  }

  private static async requestPermissions() {
    try {
      // Notification permissions
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      console.log('📱 Notification permissions:', notificationStatus);
      
      // Background fetch permissions
      const backgroundStatus = await BackgroundFetch.getStatusAsync();
      console.log('🔄 Background fetch status:', backgroundStatus);
      
      if (backgroundStatus === BackgroundFetch.BackgroundFetchStatus.Restricted) {
        console.warn('⚠️ Background fetch is restricted. Enable in Settings > General > Background App Refresh');
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  }

  private static async registerBackgroundFetch() {
    try {
      if (this.isRegistered) {
        console.log('🔄 Background fetch already registered');
        return;
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (minimum allowed by iOS)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      this.isRegistered = true;
      console.log('✅ Background fetch registered successfully');
    } catch (error) {
      console.error('❌ Failed to register background fetch:', error);
    }
  }

  static async checkAllProducts() {
    console.log('🔍 Starting manual stock check...');
    
    try {
      const products = await ProductStorage.getProducts();
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`Checking ${i + 1}/${products.length}: ${product.name}`);
        
        await this.checkSingleProduct(product);
        
        // Wait between requests
        if (i < products.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log('✅ Manual stock check completed');
    } catch (error) {
      console.error('❌ Error during stock check:', error);
    }
  }

  static async checkSingleProduct(product: Product): Promise<Product> {
    console.log(`🔍 Checking: ${product.name}`);
    
    try {
      const previousStatus = product.status;
      
      // Update status to checking
      const updatedProduct = {
        ...product,
        status: 'checking' as const,
        lastChecked: new Date().toISOString(),
      };
      
      await ProductStorage.updateProduct(updatedProduct);

      // Fetch the product page
      let html: string;
      
      try {
        // Try direct fetch first
        const response = await fetch(product.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        html = await response.text();
        console.log(`✅ Direct fetch successful: ${html.length} chars`);
        
      } catch (directError) {
        console.log(`❌ Direct fetch failed, trying proxy...`);
        
        // Fallback to proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(product.url)}`;
        const proxyResponse = await fetch(proxyUrl);
        
        if (!proxyResponse.ok) {
          throw new Error(`Proxy failed: ${proxyResponse.status}`);
        }
        
        const proxyData = await proxyResponse.json();
        html = proxyData.contents;
        console.log(`✅ Proxy fetch successful: ${html.length} chars`);
      }

      // Analyze stock status
      const stockAnalysis = this.analyzeStockStatus(html, product.url);
      
      const finalProduct = {
        ...product,
        status: stockAnalysis.isInStock ? 'in-stock' as const : 'out-of-stock' as const,
        lastChecked: new Date().toISOString(),
        confidence: stockAnalysis.confidence,
        detectedPhrases: stockAnalysis.detectedPhrases,
      };

      await ProductStorage.updateProduct(finalProduct);
      
      // Log if restocked
      if (previousStatus === 'out-of-stock' && finalProduct.status === 'in-stock') {
        console.log(`🎉 RESTOCK: ${product.name} is back in stock!`);
      }
      
      return finalProduct;

    } catch (error: any) {
      console.error(`💥 Error checking ${product.name}:`, error);
      
      const errorProduct = {
        ...product,
        status: 'error' as const,
        lastChecked: new Date().toISOString(),
        detectedPhrases: [`Error: ${error.message}`],
      };
      
      await ProductStorage.updateProduct(errorProduct);
      return errorProduct;
    }
  }

  private static analyzeStockStatus(html: string, url: string): {
    isInStock: boolean;
    confidence: 'low' | 'medium' | 'high';
    detectedPhrases: string[];
  } {
    const text = html.toLowerCase();
    let detectedPhrases: string[] = [];

    // Site-specific checks
    if (url.includes('ippodo') || url.includes('ippodotea')) {
      if (text.includes('sold out') || text.includes('完売') || text.includes('品切れ')) {
        return { isInStock: false, confidence: 'high', detectedPhrases: ['ippodo sold out'] };
      }
      if (text.includes('add to cart') || text.includes('カートに入れる')) {
        return { isInStock: true, confidence: 'high', detectedPhrases: ['ippodo add to cart'] };
      }
    }

    if (url.includes('amazon.')) {
      if (text.includes('currently unavailable') || text.includes('out of stock')) {
        return { isInStock: false, confidence: 'high', detectedPhrases: ['amazon out of stock'] };
      }
      if (text.includes('add to cart') || text.includes('buy now')) {
        return { isInStock: true, confidence: 'high', detectedPhrases: ['amazon add to cart'] };
      }
    }

    // Generic checks
    const outOfStockPhrases = [
      'out of stock', 'sold out', 'currently unavailable', 'not available',
      'temporarily out of stock', 'notify when available', 'waitlist'
    ];

    const inStockPhrases = [
      'add to cart', 'add to bag', 'buy now', 'purchase now',
      'in stock', 'available now', 'ready to ship'
    ];

    for (const phrase of outOfStockPhrases) {
      if (text.includes(phrase)) {
        detectedPhrases.push(phrase);
        return { isInStock: false, confidence: 'high', detectedPhrases };
      }
    }

    for (const phrase of inStockPhrases) {
      if (text.includes(phrase)) {
        detectedPhrases.push(phrase);
        return { isInStock: true, confidence: 'high', detectedPhrases };
      }
    }

    // Price detection
    const priceRegex = /\$\d+\.?\d*|¥\d+|€\d+|£\d+/g;
    if (html.match(priceRegex)) {
      return { isInStock: true, confidence: 'medium', detectedPhrases: ['price found'] };
    }

    // Default to out of stock if uncertain
    return { isInStock: false, confidence: 'low', detectedPhrases: ['no clear indicators'] };
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

  // Method for immediate checking of new products
  static async checkNewProduct(product: Product): Promise<Product> {
    console.log(`🆕 Immediately checking new product: ${product.name}`);
    return await this.checkSingleProduct(product);
  }
}