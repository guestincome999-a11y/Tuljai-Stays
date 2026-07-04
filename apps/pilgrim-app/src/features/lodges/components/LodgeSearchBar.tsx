import { Searchbar } from 'react-native-paper';

interface LodgeSearchBarProps {
  onChangeSearch: (search: string) => void;
  onSubmit?: () => void;
  value: string;
}

export function LodgeSearchBar({ onChangeSearch, onSubmit, value }: LodgeSearchBarProps) {
  return (
    <Searchbar
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
