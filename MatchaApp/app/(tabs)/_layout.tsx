import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { MatchaStockService } from '@/services/MatchaStockService';

export default function RootLayout() {
  // Initialize background processing when the app starts
  useEffect(() => {
    console.log('🍵 Initializing Matcha Stock Service at app root...');
    
    MatchaStockService.initialize()
      .then(() => {
        console.log('✅ Background stock checker initialized successfully');
      })
      .catch((error) => {
        console.error('❌ Failed to initialize background stock checker:', error);
      });
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}