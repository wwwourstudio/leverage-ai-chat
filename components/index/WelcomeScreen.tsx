import { Sparkles } from 'lucide-react';

interface Props {
  welcomeText: string;
}

/**
 * Empty-state display shown when a chat has no messages yet.
 */
export function WelcomeScreen({ welcomeText }: Props) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-lg font-bold text-gray-300">{welcomeText}</h3>
        <p className="text-sm text-gray-500">Start a conversation to get AI-powered insights</p>
      </div>
    </div>
  );
}
