import React from 'react';
import GlassSurface from './GlassSurface';
import { NostrNote } from '@/services/nostrService';

interface PostDisplayProps {
  originalNote: NostrNote;
  replyCount: number;
}

const PostDisplay: React.FC<PostDisplayProps> = ({ originalNote, replyCount }) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <GlassSurface 
      width="100%" 
      height="auto"
      borderRadius={24}
      brightness={70}
      opacity={0.9}
      className="p-6 mb-8"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {originalNote.author?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {originalNote.author?.name || 'Anonymous'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formatDate(originalNote.created_at)}
                </p>
              </div>
            </div>
            
            <div className="text-foreground leading-relaxed mb-4">
              {truncateContent(originalNote.content)}
            </div>
            
            <div className="flex items-center space-x-6 text-muted-foreground">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{replyCount}</span>
                <span className="text-sm">replies</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">•</span>
                <span className="text-sm">Thread Analysis</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-border/20">
          <p className="text-xs text-muted-foreground">
            Note ID: {originalNote.id.substring(0, 16)}...
          </p>
        </div>
      </div>
    </GlassSurface>
  );
};

export default PostDisplay;