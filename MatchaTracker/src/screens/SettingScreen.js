import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StockCheckService } from '../services/StockCheckService';

export default function SettingsScreen() {
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const autoCheck = await AsyncStorage.getItem('autoCheckEnabled');
      const notifications = await AsyncStorage.getItem('notificationsEnabled');
      
      setAutoCheckEnabled(autoCheck !== 'false');
      setNotificationsEnabled(notifications !== 'false');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const toggleAutoCheck = async (value) => {
    setAutoCheckEnabled(value);
    await AsyncStorage.setItem('autoCheckEnabled', value.toString());
    
    if (value) {
      StockCheckService.startPeriodicChecking();
    } else {
      StockCheckService.stopPeriodicChecking();
    }
  };

  const toggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('notificationsEnabled', value.toString());
  };

  const handleCheckAllNow = () => {
    Alert.alert(
      'Check All Products',
      'This will check the stock status of all your tracked products. This may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Now',
          onPress: () => {
            StockCheckService.checkAllProducts();
            Alert.alert('Started', 'Checking all products in the background. You\'ll see updates on the Home screen.');
          },
        },
      ],
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL tracked products. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Cleared', 'All data has been cleared.');
          },
        },
      ],
    );
  };

  const SettingRow = ({ title, subtitle, value, onValueChange, icon }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Ionicons name={icon} size={24} color="#5a7c3a" style={styles.settingIcon} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ccc', true: '#a8e6cf' }}
        thumbColor={value ? '#5a7c3a' : '#f4f3f4'}
      />
    </View>
  );

  const ActionButton = ({ title, subtitle, icon, onPress, color = '#5a7c3a' }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={24} color={color} style={styles.actionIcon} />
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automation</Text>
          <View style={styles.sectionContent}>
            <SettingRow
              title="Auto-Check Products"
              subtitle="Automatically check stock every hour"
              value={autoCheckEnabled}
              onValueChange={toggleAutoCheck}
              icon="time"
            />
            <SettingRow
              title="Push Notifications"
              subtitle="Get notified when products restock"
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              icon="notifications"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.sectionContent}>
            <ActionButton
              title="Check All Products Now"
              subtitle="Manually check all products immediately"
              icon="refresh"
              onPress={handleCheckAllNow}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.sectionContent}>
            <ActionButton
              title="Clear All Data"
              subtitle="Delete all tracked products"
              icon="trash"
              onPress={handleClearAllData}
              color="#f44336"
            />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoText}>
            This app tracks matcha product stock status by periodically checking product pages.
            Enable notifications to get instant alerts when sold-out items come back in stock.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  sectionContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  info: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    textAlign: 'center',
  },
});