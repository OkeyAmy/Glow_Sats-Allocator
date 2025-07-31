import GlassSurface from './GlassSurface';

interface LoadingScreenProps {
  status: string;
}

const LoadingScreen = ({ status }: LoadingScreenProps) => {
  return (
    <div className="w-full max-w-lg mx-auto">
      <GlassSurface 
        width="100%" 
        height="auto"
        borderRadius={24}
        brightness={70}
        opacity={0.9}
        className="p-8 text-center"
      >
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
        
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Analyzing Thread
        </h2>
        
        <p className="text-muted-foreground text-lg leading-relaxed">
          {status}
        </p>
        
        <div className="mt-8 w-full bg-muted/20 rounded-full h-3">
          <div className="bg-gradient-primary h-3 rounded-full animate-pulse w-3/4 transition-all duration-1000"></div>
        </div>
      </GlassSurface>
    </div>
  );
};

export default LoadingScreen;