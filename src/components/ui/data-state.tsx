import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error | null;
  onRetry: () => void;
  message?: string;
}

export const ErrorView: React.FC<ErrorBoundaryProps> = ({ 
  error, 
  onRetry, 
  message = "An error occurred while loading data" 
}) => {
  const isNetworkError = error?.message?.toLowerCase().includes('network') || 
                        error?.message?.toLowerCase().includes('fetch');
  
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-2">
            {isNetworkError ? (
              <WifiOff className="h-5 w-5 text-destructive" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-destructive">
                {isNetworkError ? 'Connection Error' : 'Error Loading Data'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {message}
              </p>
              {error?.message && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  {error.message}
                </p>
              )}
            </div>
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Try Again
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = "Loading...", 
  fullScreen = false 
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
  
  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {content}
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      {content}
    </div>
  );
};

interface DataStateWrapperProps {
  loading: boolean;
  error: Error | null;
  data: any;
  onRetry: () => void;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  children: React.ReactNode;
}

export const DataStateWrapper: React.FC<DataStateWrapperProps> = ({
  loading,
  error,
  data,
  onRetry,
  loadingMessage = "Loading data...",
  errorMessage = "Failed to load data",
  emptyMessage = "No data available",
  children
}) => {
  // Show loading spinner
  if (loading) {
    return <LoadingSpinner message={loadingMessage} />;
  }
  
  // Show error state with retry
  if (error) {
    return <ErrorView error={error} onRetry={onRetry} message={errorMessage} />;
  }
  
  // Show empty state
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>{emptyMessage}</AlertDescription>
      </Alert>
    );
  }
  
  // Render children with data
  return <>{children}</>;
};

interface TimeoutWrapperProps {
  loading: boolean;
  timeoutMs?: number;
  onTimeout?: () => void;
  children: React.ReactNode;
}

export const TimeoutWrapper: React.FC<TimeoutWrapperProps> = ({
  loading,
  timeoutMs = 10000, // 10 seconds default
  onTimeout,
  children
}) => {
  const [timedOut, setTimedOut] = React.useState(false);
  
  React.useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeoutMs);
    
    return () => clearTimeout(timer);
  }, [loading, timeoutMs, onTimeout]);
  
  if (loading && timedOut) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Loading Timeout</AlertTitle>
        <AlertDescription>
          This is taking longer than expected. Please check your connection and try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }
  
  return <>{children}</>;
};
