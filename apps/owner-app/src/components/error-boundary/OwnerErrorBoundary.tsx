import { radius, spacing } from '@tuljai/ui';
import { router } from 'expo-router';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

interface OwnerErrorBoundaryProps {
  children: ReactNode;
}

interface OwnerErrorBoundaryState {
  hasError: boolean;
}

export class OwnerErrorBoundary extends Component<
  OwnerErrorBoundaryProps,
  OwnerErrorBoundaryState
> {
  public state: OwnerErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): OwnerErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void error;
    void errorInfo;
    // Crash details stay out of the user interface and can be routed to a logger later.
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="headlineSmall">Something went wrong.</Text>
            <Text variant="bodyMedium">Please try again or restart the app.</Text>
            <Button mode="contained" onPress={() => this.setState({ hasError: false })}>
              Retry
            </Button>
            <Button
              mode="contained-tonal"
              onPress={() => {
                this.setState({ hasError: false });
                router.replace('/(app)/dashboard');
              }}
            >
              Go to Dashboard
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    width: '100%',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    gap: spacing.md,
  },
});
