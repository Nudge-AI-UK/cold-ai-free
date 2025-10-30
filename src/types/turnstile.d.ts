// Cloudflare Turnstile Type Declarations
interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  tabindex?: number;
  action?: string;
  cData?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
}

interface Turnstile {
  render(
    container: string | HTMLElement,
    options: TurnstileOptions
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
  getResponse(widgetId?: string): string | undefined;
}

interface Window {
  turnstile?: Turnstile;
}
