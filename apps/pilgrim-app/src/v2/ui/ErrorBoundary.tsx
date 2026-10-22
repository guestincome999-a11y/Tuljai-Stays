import { Component } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DEFAULT_THEME_TOKENS, buildColors } from '../design/theme';
import { gutter, space } from '../design/tokens';

import { Button } from './Button';
import { Text } from './Text';

interface State {
  failed: boolean;
}

/** Last-resort screen so an unexpected error never leaves a blank white app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public render() {
    if (!this.state.failed) return this.props.children;
    const colors = buildColors(DEFAULT_THEME_TOKENS);

    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text align="center" variant="title">
          Something went wrong
        </Text>
        <Text align="center" color="inkMuted">
          Please try again. If it keeps happening, restart the app.
        </Text>
        <Button label="Try again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'stretch',
    flex: 1,
    gap: space.lg,
    justifyContent: 'center',
    padding: gutter,
  },
});
