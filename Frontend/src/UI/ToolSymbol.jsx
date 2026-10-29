import React from 'react';
import { 
    Globe, 
    Code2, 
    PlaySquare, 
    FolderGit2, 
    BookOpen, 
    FileText, 
    Map, 
    Sparkles 
} from 'lucide-react';
import './ToolSymbols.scss';

/**
 * Universal Tool Symbol Component
 * Renders distinct visual symbols for all AI Assistant tools and context sources.
 * 
 * @param {Object} props
 * @param {'web'|'leetcode'|'video'|'github'|'docs'|'resume'|'roadmap'|'ai'} props.type - Tool category
 * @param {'xs'|'sm'|'md'|'lg'} [props.size='sm'] - Symbol size
 * @param {string} [props.className] - Additional class names
 */
export function ToolSymbol({ type = 'web', size = 'sm', className = '' }) {
    const normType = String(type || '').toLowerCase();

    const getIcon = () => {
        switch (normType) {
            case 'web':
            case 'search':
                return <Globe className="symbol-svg" />;
            case 'leetcode':
            case 'dsa':
            case 'code':
                return <Code2 className="symbol-svg" />;
            case 'video':
            case 'youtube':
                return <PlaySquare className="symbol-svg" />;
            case 'github':
            case 'repo':
            case 'project':
                return <FolderGit2 className="symbol-svg" />;
            case 'docs':
            case 'documentation':
                return <BookOpen className="symbol-svg" />;
            case 'resume':
            case 'cv':
                return <FileText className="symbol-svg" />;
            case 'roadmap':
            case 'milestone':
                return <Map className="symbol-svg" />;
            default:
                return <Sparkles className="symbol-svg" />;
        }
    };

    return (
        <span 
            className={`kivi-tool-symbol type-${normType} size-${size} ${className}`}
            aria-label={`Tool symbol: ${normType}`}
        >
            {getIcon()}
        </span>
    );
}

export default ToolSymbol;
