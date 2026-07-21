import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getBuiltInApiKey } from './config';

const globalLogs: string[] = [];

// Helper to read cached credentials securely
async function getCredentials(): Promise<{ apiKey: string | null; token: string | null }> {
  try {
    const builtInKey = getBuiltInApiKey();
    let apiKey = builtInKey;
    if (!apiKey) {
      if (Platform.OS === 'web') {
        apiKey = await AsyncStorage.getItem('averon_api_key');
      } else {
        apiKey = await SecureStore.getItemAsync('averon_api_key');
      }
    }

    let token: string | null = null;
    if (Platform.OS === 'web') {
      token = await AsyncStorage.getItem('averon_aluno_token');
    } else {
      token = await SecureStore.getItemAsync('averon_aluno_token');
    }

    return { apiKey, token };
  } catch {
    return { apiKey: null, token: null };
  }
}

// Upload log entry to the server in background
async function uploadLog(namespace: string, level: string, message: string, details?: any) {
  try {
    const { apiKey, token } = await getCredentials();
    if (!apiKey) return;

    // Dynamically require BASE_URL to prevent circular imports
    const averonService = require('@/services/averon');
    const baseUrl = averonService.BASE_URL;
    if (!baseUrl) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (token) {
      headers['x-aluno-token'] = token;
    }

    await fetch(`${baseUrl}/logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        namespace,
        level,
        message,
        details: details || {},
      }),
    });
  } catch (err) {
    // Fail silently in app to prevent console spam
  }
}

export const createLogger = (namespace: string) => {
  const log = (msg: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const entry = data ? `${timestamp} [${namespace}] ${msg} ${JSON.stringify(data)}` : `${timestamp} [${namespace}] ${msg}`;
    globalLogs.push(entry);
    console.log(entry);

    // Upload to server asynchronously
    uploadLog(namespace, 'info', msg, data).catch(() => {});
  };

  const error = (msg: string, err?: any) => {
    const timestamp = new Date().toISOString();
    const entry = err ? `${timestamp} [${namespace}] ERROR ${msg} ${err}` : `${timestamp} [${namespace}] ERROR ${msg}`;
    globalLogs.push(entry);
    console.error(entry);

    // Format error details
    const details = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { error: err };

    // Upload to server asynchronously
    uploadLog(namespace, 'error', msg, details).catch(() => {});
  };

  const getLogs = () => globalLogs;
  return { log, error, getLogs };
};

// Hook version for React components
export const useLogger = (namespace: string) => {
  return React.useMemo(() => createLogger(namespace), [namespace]);
};
