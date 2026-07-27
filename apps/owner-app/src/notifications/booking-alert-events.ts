export interface BookingAlertSignal {
  bookingId: string;
  lodgeId: string | null;
  receivedAt: number;
}

type BookingAlertListener = (signal: BookingAlertSignal) => void;

const listeners = new Set<BookingAlertListener>();
let latestSignal: BookingAlertSignal | null = null;

export function publishBookingAlert(signal: BookingAlertSignal): void {
  latestSignal = signal;

  for (const listener of listeners) {
    listener(signal);
  }
}

export function subscribeToBookingAlerts(listener: BookingAlertListener): () => void {
  listeners.add(listener);

  if (latestSignal && Date.now() - latestSignal.receivedAt < 120_000) {
    listener(latestSignal);
  }

  return () => {
    listeners.delete(listener);
  };
}
