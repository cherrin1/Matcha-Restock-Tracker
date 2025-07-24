import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ProductStorage } from '../../services/ProductStorage';
import { router } from 'expo-router';

const BRANDS = [
  'Ippodo',
  'Marukyu Koyamaen',
  'Yamamasa Koyamaen', 
  'Hibiki-an',
  'Encha',
  'Jade Leaf',
  'Mizuba Tea',
  'Kettl',
  'DoMatcha',
  'MatchaBar',
  'Kenko Tea',
  'Matcha Maiden',
  'Chalait',
  'Republic of Tea',
  'Tenzo Tea',
  'Other',
];

export default function AddProductScreen() {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(BRANDS[0]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  const validateUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  };

  const handleAddProduct = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a product URL');
      return;
    }

    if (!validateUrl(url)) {
      Alert.alert('Error', 'Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    setLoading(true);

    try {
      // Actually save the product
      await ProductStorage.addProduct(name.trim(), brand, url.trim());

      Alert.alert(
        'Success',
        'Product added successfully! You can now see it on the Home tab.',
        [
          {
            text: 'View Products',
            onPress: () => {
              // Clear form
              setName('');
              setUrl('');
              setBrand(BRANDS[0]);
              // Navigate to home tab
              router.push('/(tabs)');
            },
          },
          {
            text: 'Add Another',
            style: 'cancel',
            onPress: () => {
              // Clear form but stay on this screen
              setName('');
              setUrl('');
              setBrand(BRANDS[0]);
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add product. Please try again.');
      console.error('Error adding product:', error);
    }

    setLoading(false);
  };

  const BrandPickerModal = () => (
    <Modal
      visible={showBrandPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowBrandPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowBrandPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1} 
          onPress={() => {}}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Brand</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowBrandPicker(false)}
            >
              <FontAwesome name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.brandList} 
            contentContainerStyle={styles.brandListContent}
            showsVerticalScrollIndicator={true}
          >
            {BRANDS.map((brandName, index) => (
              <TouchableOpacity
                key={brandName}
                style={[
                  styles.brandOption,
                  brand === brandName && styles.brandOptionSelected,
                  index === BRANDS.length - 1 && styles.brandOptionLast
                ]}
                onPress={() => {
                  setBrand(brandName);
                  setShowBrandPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.brandOptionText,
                  brand === brandName && styles.brandOptionTextSelected
                ]}>
                  {brandName}
                </Text>
                {brand === brandName && (
                  <FontAwesome name="check" size={16} color="#5a7c3a" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <FontAwesome name="plus-circle" size={48} color="#5a7c3a" />
              <Text style={styles.title}>Add New Product</Text>
              <Text style={styles.subtitle}>
                Track any matcha product from any website
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Ceremonial Grade Matcha"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Brand</Text>
                <TouchableOpacity
                  style={styles.brandSelector}
                  onPress={() => setShowBrandPicker(true)}
                >
                  <Text style={styles.brandSelectorText}>{brand}</Text>
                  <FontAwesome name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Product URL</Text>
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://..."
                  placeholderTextColor="#999"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.addButton, loading && styles.addButtonDisabled]}
                onPress={handleAddProduct}
                disabled={loading}
              >
                <Text style={styles.addButtonText}>
                  {loading ? 'Adding Product...' : 'Add Product'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>💡 Tips:</Text>
              <Text style={styles.tipText}>
                • Visit the product page in your browser and copy the URL
              </Text>
              <Text style={styles.tipText}>
                • Make sure the URL goes directly to the specific product
              </Text>
              <Text style={styles.tipText}>
                • Products will appear on the Home tab after adding
              </Text>
              <Text style={styles.tipText}>
                • You can tap products to open them in your browser
              </Text>
              <Text style={styles.tipText}>
                • The app will automatically check stock status every 30 minutes
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <BrandPickerModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d5016',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#5a7c3a',
    marginTop: 5,
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  brandSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  brandSelectorText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#5a7c3a',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonDisabled: {
    backgroundColor: '#999',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tips: {
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    padding: 15,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d5016',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#5a7c3a',
    marginBottom: 5,
    lineHeight: 20,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    height: '80%',
    flex: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d5016',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  brandList: {
    flex: 1,
    backgroundColor: 'white',
  },
  brandListContent: {
    paddingBottom: 40,
  },
  brandOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
    minHeight: 60,
  },
  brandOptionSelected: {
    backgroundColor: '#e8f5e8',
  },
  brandOptionLast: {
    borderBottomWidth: 0,
  },
  brandOptionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  brandOptionTextSelected: {
    color: '#2d5016',
    fontWeight: '600',
  },
});