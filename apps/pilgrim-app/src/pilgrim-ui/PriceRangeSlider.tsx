import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  PanResponder,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  Text,
  View,
} from 'react-native';

import { formatRupees } from './mock-data';

const THUMB_SIZE = 28;
const THUMB_RADIUS = THUMB_SIZE / 2;

interface PriceRangeSliderProps {
  maximumLabel: string;
  minimumLabel: string;
  min: number;
  max: number;
  onChange: (minimum: number, maximum: number) => void;
  step?: number;
  valueMax: number;
  valueMin: number;
}

type ActiveThumb = 'maximum' | 'minimum';

export function PriceRangeSlider({
  maximumLabel,
  minimumLabel,
  min,
  max,
  onChange,
  step = 100,
  valueMax,
  valueMin,
}: PriceRangeSliderProps) {
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackStartRef = useRef(0);
  const activeThumbRef = useRef<ActiveThumb>('minimum');
  const valuesRef = useRef({ maximum: valueMax, minimum: valueMin });
  const limitsRef = useRef({ max, min, step });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valuesRef.current = { maximum: valueMax, minimum: valueMin };
  }, [valueMax, valueMin]);

  useEffect(() => {
    limitsRef.current = { max, min, step };
  }, [max, min, step]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const updateTrackPosition = () => {
    trackRef.current?.measureInWindow((x) => {
      trackStartRef.current = x + THUMB_RADIUS;
    });
  };

  const updateFromPageX = (pageX: number, chooseThumb: boolean) => {
    const usableWidth = Math.max(1, trackWidthRef.current - THUMB_SIZE);
    const fraction = clamp((pageX - trackStartRef.current) / usableWidth, 0, 1);
    const { max: upperLimit, min: lowerLimit, step: priceStep } = limitsRef.current;
    const rawValue = lowerLimit + fraction * (upperLimit - lowerLimit);
    const nextValue = snapToStep(rawValue, lowerLimit, upperLimit, priceStep);
    const current = valuesRef.current;

    if (chooseThumb) {
      activeThumbRef.current =
        Math.abs(nextValue - current.minimum) <= Math.abs(nextValue - current.maximum)
          ? 'minimum'
          : 'maximum';
    }

    updateThumb(activeThumbRef.current, nextValue, valuesRef, onChangeRef);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_event, gestureState) => {
          updateTrackPosition();
          requestAnimationFrame(() => updateFromPageX(gestureState.x0, true));
        },
        onPanResponderMove: (_event, gestureState) => {
          updateFromPageX(gestureState.moveX, false);
        },
        onPanResponderTerminationRequest: () => false,
        onStartShouldSetPanResponder: () => true,
      }),
    [],
  );

  const usableWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const minimumPosition = THUMB_RADIUS + percentage(valueMin, min, max) * Math.max(0, usableWidth);
  const maximumPosition = THUMB_RADIUS + percentage(valueMax, min, max) * Math.max(0, usableWidth);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    trackWidthRef.current = nextWidth;
    setTrackWidth(nextWidth);
    updateTrackPosition();
  };

  const adjustThumb = (thumb: ActiveThumb, direction: -1 | 1) => {
    const current = valuesRef.current;
    const nextValue =
      (thumb === 'minimum' ? current.minimum : current.maximum) +
      direction * limitsRef.current.step;
    updateThumb(thumb, nextValue, valuesRef, onChangeRef);
  };

  return (
    <View>
      <View className="flex-row items-center gap-3">
        <PriceValue label={minimumLabel} value={valueMin} />
        <View className="h-px w-5 bg-warm-300" />
        <PriceValue label={maximumLabel} value={valueMax} />
      </View>

      <View
        {...panResponder.panHandlers}
        className="relative mt-5 h-12 justify-center"
        onLayout={handleLayout}
        ref={trackRef}
        testID="price-range-track"
      >
        <View
          className="absolute h-1.5 rounded-full bg-warm-200"
          pointerEvents="none"
          style={{ left: THUMB_RADIUS, right: THUMB_RADIUS }}
        />
        <View
          className="absolute h-1.5 rounded-full bg-saffron-500"
          pointerEvents="none"
          style={{
            left: minimumPosition,
            width: Math.max(0, maximumPosition - minimumPosition),
          }}
        />
        <View
          accessibilityActions={[
            { label: 'Increase minimum price', name: 'increment' },
            { label: 'Decrease minimum price', name: 'decrement' },
          ]}
          accessibilityLabel={minimumLabel}
          accessibilityRole="adjustable"
          accessibilityValue={{
            max: valueMax,
            min,
            now: valueMin,
            text: formatRupees(valueMin),
          }}
          className="absolute h-7 w-7 rounded-full border-4 border-saffron-500 bg-white shadow-md shadow-warm-900/20"
          onAccessibilityAction={(event: AccessibilityActionEvent) =>
            adjustThumb('minimum', event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          style={{ left: minimumPosition - THUMB_RADIUS }}
        />
        <View
          accessibilityActions={[
            { label: 'Increase maximum price', name: 'increment' },
            { label: 'Decrease maximum price', name: 'decrement' },
          ]}
          accessibilityLabel={maximumLabel}
          accessibilityRole="adjustable"
          accessibilityValue={{
            max,
            min: valueMin,
            now: valueMax,
            text: formatRupees(valueMax),
          }}
          className="absolute h-7 w-7 rounded-full border-4 border-maroon-700 bg-white shadow-md shadow-warm-900/20"
          onAccessibilityAction={(event: AccessibilityActionEvent) =>
            adjustThumb('maximum', event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          style={{ left: maximumPosition - THUMB_RADIUS }}
        />
      </View>

      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-warm-500">{formatRupees(min)}</Text>
        <Text className="text-xs font-semibold text-warm-500">{formatRupees(max)}</Text>
      </View>
    </View>
  );
}

function PriceValue({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl border border-warm-200 bg-warm-50 px-4 py-3">
      <Text className="text-xs font-semibold text-warm-500">{label}</Text>
      <Text className="mt-1 text-lg font-extrabold text-warm-900">{formatRupees(value)}</Text>
    </View>
  );
}

function updateThumb(
  thumb: ActiveThumb,
  value: number,
  valuesRef: RefObject<{ maximum: number; minimum: number }>,
  onChangeRef: RefObject<(minimum: number, maximum: number) => void>,
): void {
  const current = valuesRef.current;
  const next =
    thumb === 'minimum'
      ? { maximum: current.maximum, minimum: Math.min(value, current.maximum) }
      : { maximum: Math.max(value, current.minimum), minimum: current.minimum };
  valuesRef.current = next;
  onChangeRef.current(next.minimum, next.maximum);
}

function percentage(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return clamp(snapped, min, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
