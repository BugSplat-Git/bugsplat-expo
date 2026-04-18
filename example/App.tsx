import { useState } from 'react';
import { init, post, setUser, setAttribute, removeAttribute, crash, hang, nativeAvailable, ErrorBoundary } from '@bugsplat/expo';
import { Platform } from 'react-native';
import { Button, Image, ScrollView, Text, View, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

const DATABASE = 'your-database';
const APP_NAME = 'bugsplat-expo-example';
const APP_VERSION = '1.0.0';

function BuggyComponent() {
  throw new Error('Test render error caught by ErrorBoundary');
}

export default function App() {
  const [status, setStatus] = useState('Not initialized');
  const [database, setDatabase] = useState(DATABASE);
  const [attrKey, setAttrKey] = useState('environment');
  const [attrValue, setAttrValue] = useState('development');
  const [activeAttributes, setActiveAttributes] = useState<Record<string, string>>({});
  const [triggerRenderError, setTriggerRenderError] = useState(false);

  const handleInit = async () => {
    try {
      await init(database, APP_NAME, APP_VERSION, {
        userName: 'Test User',
        userEmail: 'test@example.com',
      });
      setStatus('Initialized!');
    } catch (e) {
      setStatus(`Init failed: ${e}`);
    }
  };

  const handlePost = async () => {
    try {
      const result = await post(new Error('Test error from bugsplat-expo example'));
      setStatus(result.success ? 'Error posted!' : `Post failed: ${result.error}`);
    } catch (e) {
      setStatus(`Post failed: ${e}`);
    }
  };

  const handleSetUser = () => {
    setUser('Example User', 'user@example.com');
    setStatus('User set!');
  };

  const handleSetAttribute = () => {
    if (!attrKey.trim()) {
      setStatus('Attribute key cannot be empty');
      return;
    }
    setAttribute(attrKey, attrValue);
    setActiveAttributes((prev) => ({ ...prev, [attrKey]: attrValue }));
    setStatus(`Attribute set: ${attrKey} = ${attrValue}`);
  };

  const handleRemoveAttribute = (key: string) => {
    removeAttribute(key);
    setActiveAttributes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setStatus(`Attribute removed: ${key}`);
  };

  const handleCrash = () => {
    crash();
  };

  const handleHang = () => {
    setStatus('Hanging main thread — app should ANR shortly…');
    hang();
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Image source={require('./assets/bug.png')} style={styles.logo} />
        <Text style={styles.header}>BugSplat Expo Example</Text>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Status</Text>
          <Text>{status}</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Database</Text>
          <TextInput
            style={styles.input}
            value={database}
            onChangeText={setDatabase}
            placeholder="Enter BugSplat database name"
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Actions</Text>
          <View style={styles.buttonRow}>
            <Button title="Init" onPress={handleInit} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Post Error" onPress={handlePost} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Set User" onPress={handleSetUser} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Set Attribute" onPress={handleSetAttribute} />
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Attributes</Text>
          <TextInput
            style={styles.input}
            value={attrKey}
            onChangeText={setAttrKey}
            placeholder="Attribute key"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={attrValue}
            onChangeText={setAttrValue}
            placeholder="Attribute value"
          />
          {Object.entries(activeAttributes).map(([key, value]) => (
            <View key={key} style={styles.attributeRow}>
              <Text style={styles.attributeText}>{key}: {value}</Text>
              <Button title="Remove" onPress={() => handleRemoveAttribute(key)} color="red" />
            </View>
          ))}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Native Crash</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Test Crash"
              onPress={handleCrash}
              color={nativeAvailable && !__DEV__ ? 'red' : 'gray'}
              disabled={!nativeAvailable || __DEV__}
            />
            {(!nativeAvailable || __DEV__) && (
              <Text style={styles.disabledHint}>
                Native crash testing requires a release build
              </Text>
            )}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Hang Detection (ANR)</Text>
          <View style={styles.buttonRow}>
            <Button
              title="Trigger Hang"
              onPress={handleHang}
              color={nativeAvailable && !__DEV__ && Platform.OS === 'android' ? 'red' : 'gray'}
              disabled={!nativeAvailable || __DEV__ || Platform.OS !== 'android'}
            />
            {Platform.OS !== 'android' ? (
              <Text style={styles.disabledHint}>
                Hang detection is currently Android-only
              </Text>
            ) : (!nativeAvailable || __DEV__) && (
              <Text style={styles.disabledHint}>
                Hang testing requires a release build
              </Text>
            )}
          </View>
        </View>

        <View style={styles.group}>
          <Text style={styles.groupHeader}>Error Boundary</Text>
          <ErrorBoundary
            fallback={({ error, resetErrorBoundary }) => (
              <View>
                <Text style={styles.errorText}>Caught: {error.message}</Text>
                <Button title="Reset" onPress={() => {
                  setTriggerRenderError(false);
                  resetErrorBoundary();
                }} />
              </View>
            )}
          >
            {triggerRenderError && <BuggyComponent />}
          </ErrorBoundary>
          <View style={styles.buttonRow}>
            <Button
              title="Trigger Render Error"
              onPress={() => setTriggerRenderError(true)}
              color="orange"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 20,
    textAlign: 'center',
  },
  groupHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  group: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  buttonRow: {
    marginVertical: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  attributeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  attributeText: {
    fontSize: 14,
    flex: 1,
  },
  disabledHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 8,
  },
});
