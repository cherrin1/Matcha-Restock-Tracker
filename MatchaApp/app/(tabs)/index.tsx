import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ProductStorage, Product } from '../../services/ProductStorage';
import { MatchaStockService } from '../../services/MatchaStockService';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ 
    total: 0, 
    inStock: 0, 
    outOfStock: 0, 
    checking: 0, 
    errors: 0 
  });

  const loadProducts = useCallback(async () => {
    const loadedProducts = await ProductStorage.getProducts();
    const statsData = await MatchaStockService.getStats();
    setProducts(loadedProducts);
    setStats(statsData);
  }, []);

  // Load products when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  // Auto-refresh every 30 seconds when screen is active
  useEffect(() => {
    const interval = setInterval(loadProducts, 30000);
    return () => clearInterval(interval);
  }, [loadProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Trigger actual stock checking, not just data loading
    await MatchaStockService.checkAllProducts();
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const handleCheckProduct = async (product: Product) => {
    console.log('🔧 handleCheckProduct called for:', product.name);
    console.log('🔧 Product URL:', product.url);
    console.log('🔧 Current status:', product.status);
    
    try {
      console.log('🔧 Calling MatchaStockService.checkSingleProduct...');
      const result = await MatchaStockService.checkSingleProduct(product);
      console.log('🔧 Service returned:', result);
      await loadProducts();
      console.log('🔧 Products reloaded');
    } catch (error) {
      console.error('🔧 handleCheckProduct error:', error);
    }
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to stop tracking "${productName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await ProductStorage.deleteProduct(productId);
            await loadProducts();
          },
        },
      ],
    );
  };

  const handleOpenProduct = (url: string) => {
    Linking.openURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock': return '#4caf50';
      case 'out-of-stock': return '#f44336';
      case 'checking': return '#ff9800';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in-stock': return 'IN STOCK';
      case 'out-of-stock': return 'OUT OF STOCK';
      case 'checking': return 'CHECKING...';
      default: return 'ERROR';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in-stock': return 'check-circle';
      case 'out-of-stock': return 'times-circle';
      case 'checking': return 'clock-o';
      default: return 'exclamation-circle';
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.productCard, { borderLeftColor: getStatusColor(item.status) }]}
      onPress={() => handleOpenProduct(item.url)}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productBrand}>{item.brand}</Text>
          
          <View style={styles.statusRow}>
            <FontAwesome 
              name={getStatusIcon(item.status)} 
              size={12} 
              color={getStatusColor(item.status)} 
            />
            <Text style={[styles.productStatus, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
            {item.status === 'checking' && (
              <ActivityIndicator size="small" color="#ff9800" style={{ marginLeft: 5 }} />
            )}
          </View>

          {item.confidence && (
            <Text style={styles.confidence}>
              {item.confidence.toUpperCase()} CONFIDENCE
            </Text>
          )}
        </View>
        
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, item.status === 'checking' && styles.actionButtonDisabled]}
            onPress={() => handleCheckProduct(item)}
            disabled={item.status === 'checking'}
          >
            <FontAwesome 
              name="refresh" 
              size={16} 
              color={item.status === 'checking' ? '#ccc' : '#2196f3'} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteProduct(item.id, item.name)}
          >
            <FontAwesome name="trash" size={16} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
      
      {item.lastChecked && (
        <Text style={styles.lastChecked}>
          Last checked: {new Date(item.lastChecked).toLocaleString()}
        </Text>
      )}

      {item.detectedPhrases && item.detectedPhrases.length > 0 && (
        <Text style={styles.detectedPhrases}>
          Detected: {item.detectedPhrases.slice(0, 2).join(', ')}
        </Text>
      )}
    </TouchableOpacity>
  );

  const StatCard = ({ title, value, color }: {title: string; value: number; color: string}) => (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🍵 Matcha Restock Tracker</Text>
          <Text style={styles.headerSubtitle}>Never miss a matcha restock again!</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatCard title="Tracked" value={stats.total} color="#2d5016" />
          <StatCard title="In Stock" value={stats.inStock} color="#4caf50" />
          <StatCard title="Out of Stock" value={stats.outOfStock} color="#f44336" />
          <StatCard title="Checking" value={stats.checking} color="#ff9800" />
        </View>

        {/* Debug Button */}
        <TouchableOpacity
          style={{
            backgroundColor: '#ff6b6b',
            padding: 15,
            margin: 20,
            borderRadius: 8,
            alignItems: 'center',
          }}
          onPress={async () => {
            console.log('🧪 DEBUG: Testing fetch capability...');
            
            try {
              // Test 1: Basic fetch
              console.log('🧪 Test 1: Testing basic fetch...');
              const testUrl = 'https://httpbin.org/json';
              const response1 = await fetch(testUrl);
              const data1 = await response1.json();
              console.log('✅ Test 1 passed:', data1);
              
              // Test 2: CORS proxy
              console.log('🧪 Test 2: Testing CORS proxy...');
              const proxyUrl = `https://cors.sh/https://www.amazon.com/dp/B00JBQZPX8`;
              console.log('📡 Proxy URL:', proxyUrl);
              
              const response2 = await fetch(proxyUrl);
              console.log('📊 Proxy response status:', response2.status);
              
              const data2 = await response2.text();
              console.log('📄 Content length:', data2?.length || 0);
              console.log('📄 First 200 chars:', data2?.substring(0, 200) || 'No content');
              
              // Test 3: Check if MatchaStockService exists
              console.log('🧪 Test 3: Testing MatchaStockService...');
              console.log('🔧 Service exists:', typeof MatchaStockService);
              console.log('🔧 checkSingleProduct exists:', typeof MatchaStockService.checkSingleProduct);
              
              Alert.alert('Debug Complete', 'Check console logs for results');
              
            } catch (error: any) {
              console.error('💥 Debug test failed:', error);
              Alert.alert('Debug Failed', error.message);
            }
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            🧪 DEBUG: Test Fetch
          </Text>
        </TouchableOpacity>

        {/* Global Actions */}
        {products.length > 0 && (
          <View style={styles.globalActions}>
            <TouchableOpacity
              style={styles.checkAllButton}
              onPress={() => {
                Alert.alert(
                  'Check All Products',
                  'This will check the stock status of all your tracked products. This may take a few minutes.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Check All',
                      onPress: async () => {
                        Alert.alert('Started', 'Checking all products in the background. Pull down to refresh and see updates.');
                        MatchaStockService.checkAllProducts();
                      },
                    },
                  ],
                );
              }}
            >
              <FontAwesome name="refresh" size={16} color="white" />
              <Text style={styles.checkAllButtonText}>Check All Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Products List or Empty State */}
        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="leaf" size={64} color="#a8e6cf" />
            <Text style={styles.emptyText}>No products tracked yet</Text>
            <Text style={styles.emptySubtext}>
              Add your first matcha product to start tracking restocks!
            </Text>
            <Text style={styles.emptyHint}>
              The app will automatically check stock every 30 minutes and notify you when items restock.
            </Text>
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={renderProduct}
            keyExtractor={item => item.id}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                title="Pull to check stock status"
                tintColor="#5a7c3a"
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#5a7c3a',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 5,
    letterSpacing: 0.5,
  },
  globalActions: {
    marginBottom: 20,
  },
  checkAllButton: {
    backgroundColor: '#5a7c3a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  checkAllButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2d5016',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  listContainer: {
    paddingBottom: 20,
  },
  productCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  productStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  confidence: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginBottom: 4,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  lastChecked: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  detectedPhrases: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
});