import { useState } from 'react';
import { init, post, setUser, setAttribute, crash, ErrorBoundary } from '@bugsplat/expo';
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
    setAttribute('environment', 'development');
    setStatus('Attribute set!');
  };

  const handleCrash = () => {
    crash();
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
          <View style={styles.buttonRow}>
            <Button title="Test Crash" onPress={handleCrash} color="red" />
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
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 8,
  },
});
