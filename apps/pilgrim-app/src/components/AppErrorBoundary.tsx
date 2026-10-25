import { radius, spacing } from '@tuljai/ui';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.error('Pilgrim app UI error', error, info.componentStack);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text variant="headlineSmall">Something went wrong.</Text>
            <Text style={styles.message} variant="bodyMedium">
              Please try again. If the problem continues, restart the app.
            </Text>
            <Button
              accessibilityLabel="Try again"
              accessibilityHint="Reloads the current app screen"
              mode="contained"
              onPress={() => this.setState({ hasError: false })}
            >
              Try Again
            </Button>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    textAlign: 'center',
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
