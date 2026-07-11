declare module 'expo-router' {
  type RouteParams = Record<string, string | number | boolean | null | undefined>;
  type Href = string | { params?: RouteParams; pathname: string };
  type RouteConfig = { name: string };
  type ScreenOptionsContext = { route: RouteConfig };
  type ScreenOptions = Record<string, unknown>;

  interface Router {
    back(): void;
    canGoBack(): boolean;
    push(href: Href): void;
    replace(href: Href): void;
  }

  interface RedirectProps {
    href: Href;
    withAnchor?: boolean;
  }

  interface NavigatorProps {
    children?: React.ReactNode;
    initialRouteName?: string;
    screenOptions?: ScreenOptions | ((context: ScreenOptionsContext) => ScreenOptions);
  }

  interface ScreenProps {
    initialParams?: RouteParams;
    name: string;
    options?: ScreenOptions;
    redirect?: boolean;
  }

  export const Redirect: React.ComponentType<RedirectProps>;
  export function Stack(props: NavigatorProps): React.ReactElement | null;
  export namespace Stack {
    export const Screen: React.ComponentType<ScreenProps>;
  }
  export function Tabs(props: NavigatorProps): React.ReactElement | null;
  export namespace Tabs {
    export const Screen: React.ComponentType<ScreenProps>;
  }
  export const router: Router;
  export function useRouter(): Router;
  export function useLocalSearchParams<
    T extends Record<string, string | string[] | undefined> = Record<
      string,
      string | string[] | undefined
    >,
  >(): T;
}
