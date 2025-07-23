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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { StockCheckService } from '../services/StockCheckService';

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
  'Other',
];

export default function AddProductScreen({ navigation }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState(BRANDS[0]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const validateUrl = (urlString) => {
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
      await StockCheckService.addProduct(name.trim(), brand, url.trim());

      Alert.alert(
        'Success',
        'Product added successfully! Stock status will be checked automatically.',
        [
          {
            text: 'OK',
            onPress: () => {
              setName('');
              setUrl('');
              setBrand(BRANDS[0]);
              navigation.navigate('Home');
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

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="add-circle" size={48} color="rgba(255, 255, 255, 0.8)" />
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
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={brand}
                    onValueChange={setBrand}
                    style={styles.picker}
                  >
                    {BRANDS.map(brandName => (
                      <Picker.Item key={brandName} label={brandName} value={brandName} />
                    ))}
                  </Picker>
                </View>
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
                • The app will automatically check stock status every hour
              </Text>
              <Text style={styles.tipText}>
                • You'll get push notifications when items restock
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: 'white',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
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
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  picker: {
    height: 50,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
    lineHeight: 20,
  },
});