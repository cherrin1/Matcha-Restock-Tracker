import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Product {
  id: string;
  name: string;
  brand: string;
  url: string;
  status: 'checking' | 'in-stock' | 'out-of-stock' | 'error';
  createdAt: string;
  lastChecked?: string;
  confidence?: 'low' | 'medium' | 'high';
  detectedPhrases?: string[];
}

export class ProductStorage {
  private static readonly STORAGE_KEY = 'matcha_products';

  static async getProducts(): Promise<Product[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading products:', error);
      return [];
    }
  }

  static async saveProducts(products: Product[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
      console.error('Error saving products:', error);
      throw error;
    }
  }

  static async addProduct(name: string, brand: string, url: string): Promise<Product> {
    const product: Product = {
      id: Date.now().toString(),
      name: name.trim(),
      brand,
      url: url.trim(),
      status: 'checking',
      createdAt: new Date().toISOString(),
    };

    try {
      const products = await this.getProducts();
      products.push(product);
      await this.saveProducts(products);
      return product;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  static async deleteProduct(productId: string): Promise<void> {
    try {
      const products = await this.getProducts();
      const filtered = products.filter(p => p.id !== productId);
      await this.saveProducts(filtered);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  static async updateProduct(updatedProduct: Product): Promise<void> {
    try {
      const products = await this.getProducts();
      const index = products.findIndex(p => p.id === updatedProduct.id);
      
      if (index >= 0) {
        products[index] = updatedProduct;
        await this.saveProducts(products);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
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