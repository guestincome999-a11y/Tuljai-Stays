import { radius, spacing } from '@tuljai/ui';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import {
  markPushPermissionPrompted,
  requestAndRegisterPushToken,
  wasPushPermissionPrompted,
} from './push-registration';

export function PushPermissionCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkPromptState() {
      const alreadyPrompted = await wasPushPermissionPrompted().catch(() => true);

      if (mounted) {
        setVisible(!alreadyPrompted);
      }
    }

    void checkPromptState();

    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">Get booking updates instantly</Text>
        <Text variant="bodyMedium">
          Allow notifications so we can tell you when your booking is accepted, QR is ready, or
          checkout time is near.
        </Text>
        {message ? <Text variant="bodySmall">{message}</Text> : null}
        <Button
          loading={loading}
          mode="contained"
          onPress={() => {
            void enableNotifications();
          }}
        >
          Allow Notifications
        </Button>
        <Button
          onPress={() => {
            void dismissPrompt();
          }}
        >
          Maybe Later
        </Button>
      </Card.Content>
    </Card>
  );

  async function enableNotifications() {
    setLoading(true);
    const result = await requestAndRegisterPushToken();
    setMessage(result.message);
    setLoading(false);

    if (result.registered) {
      setVisible(false);
    }
  }

  async function dismissPrompt() {
    await markPushPermissionPrompted();
    setVisible(false);
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.sm,
  },
});
