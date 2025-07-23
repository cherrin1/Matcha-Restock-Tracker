import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StockCheckService } from '../services/StockCheckService';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const [products, setProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, inStock: 0, outOfStock: 0, errors: 0 });

  const loadProducts = useCallback(async () => {
    const loadedProducts = await StockCheckService.getProducts();
    const statsData = await StockCheckService.getStats();
    setProducts(loadedProducts);
    setStats(statsData);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await StockCheckService.checkAllProducts();
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const handleCheckProduct = async (product) => {
    await StockCheckService.checkSingleProduct(product);
    await loadProducts();
  };

  const handleDeleteProduct = (productId, productName) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to stop tracking "${productName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await StockCheckService.deleteProduct(productId);
            await loadProducts();
          },
        },
      ],
    );
  };

  useEffect(() => {
    loadProducts();
    
    // Refresh every 30 seconds when app is active
    const interval = setInterval(loadProducts, 30000);
    return () => clearInterval(interval);
  }, [loadProducts]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'in-stock': return '#4caf50';
      case 'out-of-stock': return '#f44336';
      case 'checking': return '#ff9800';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in-stock': return 'IN STOCK';
      case 'out-of-stock': return 'OUT OF STOCK';
      case 'checking': return 'CHECKING...';
      default: return 'ERROR';
    }
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={[styles.productCard, { borderLeftColor: getStatusColor(item.status) }]}
      onPress={() => Linking.openURL(item.url)}
    >
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productBrand}>{item.brand}</Text>
          <Text style={[styles.productStatus, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
          {item.confidence && (
            <Text style={styles.confidence}>
              {item.confidence.toUpperCase()} CONFIDENCE
            </Text>
          )}
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCheckProduct(item)}
            disabled={item.status === 'checking'}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={item.status === 'checking' ? '#ccc' : '#2196f3'} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteProduct(item.id, item.name)}
          >
            <Ionicons name="trash" size={20} color="#f44336" />
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

  const StatCard = ({ title, value, color }) => (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.content}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatCard title="Tracked" value={stats.total} color="#2d5016" />
          <StatCard title="In Stock" value={stats.inStock} color="#4caf50" />
          <StatCard title="Out of Stock" value={stats.outOfStock} color="#f44336" />
          <StatCard title="Errors" value={stats.errors} color="#9e9e9e" />
        </View>

        {/* Products List */}
        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="leaf" size={64} color="rgba(255, 255, 255, 0.5)" />
            <Text style={styles.emptyText}>No products tracked yet</Text>
            <Text style={styles.emptySubtext}>
              Add your first matcha product to start tracking restocks!
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
                tintColor="#fff"
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 3,
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
  },
  listContainer: {
    paddingBottom: 20,
  },
  productCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  productStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  confidence: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});