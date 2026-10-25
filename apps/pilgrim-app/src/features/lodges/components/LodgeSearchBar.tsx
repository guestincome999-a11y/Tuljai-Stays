import { PilgrimSearchBar } from '../../../components/pilgrim-ui';

interface LodgeSearchBarProps {
  onChangeSearch: (search: string) => void;
  onSubmit?: () => void;
  value: string;
}

export function LodgeSearchBar({ onChangeSearch, onSubmit, value }: LodgeSearchBarProps) {
  return (
    <PilgrimSearchBar
      accessibilityLabel="Search lodges"
      autoCapitalize="words"
      inputMode="search"
      onChangeText={onChangeSearch}
      onSubmitEditing={onSubmit}
      placeholder="Search lodges near Tuljapur"
      value={value}
    />
  );
}
