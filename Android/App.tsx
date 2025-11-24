import React from 'react';
import {SafeAreaView, StatusBar} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {FocusTools} from './src/screens/FocusTools';

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SafeAreaView style={{flex: 1, backgroundColor: '#0f172a'}}>
        <FocusTools />
      </SafeAreaView>
    </QueryClientProvider>
  );
}

export default App;
