const { streamAssistantChat, processAssistantChat, buildAssistantPromptAndMessages, detectToolRequirement, extractSnippetFromReply, extractSnippetAndTargetFromReply } = require('./assistant.orchestrator');
const { classifyIntent, classifyIntentTier1, classifyIntentTier2, extractTopicFromPrompt } = require('./intentClassifier');
const { loadDynamicContext } = require('./dynamicContextLoader');
const { assembleContext, getRecentChatHistory, getCandidateMemoryProfile, appendChatTurn, extractCompactJdSummary } = require('./contextAssembler');
const { searchWeb, searchLearningResources, searchGitHubProjects, searchLeetCodeProblems, searchOfficialDocs, searchDynamicRoadmapResources } = require('./searchTool.service');
const { processTurnInBackground, extractQuickFacts } = require('./memoryExtractor');
const { parseResumeHtml, parseRoadmap, parseJobDescription } = require('./Chunker');
const { 
    embedChunks, 
    embedQuery, 
    getCachedChunks, 
    cacheChunks, 
    invalidateChunkCache, 
    getOrEmbedChunks,
    getOrEmbedRoadmapChunks,
    invalidateRoadmapChunkCache,
    getOrEmbedJdChunks,
    invalidateJdChunkCache,
    invalidateAllReportChunkCaches
} = require('./Embedder');

module.exports = {
    streamAssistantChat,
    processAssistantChat,
    buildAssistantPromptAndMessages,
    detectToolRequirement,
    extractSnippetFromReply,
    extractSnippetAndTargetFromReply,
    classifyIntent,
    classifyIntentTier1,
    classifyIntentTier2,
    extractTopicFromPrompt,
    loadDynamicContext,
    assembleContext,
    getRecentChatHistory,
    getCandidateMemoryProfile,
    appendChatTurn,
    extractCompactJdSummary,
    // Search Tools
    searchWeb,
    searchLearningResources,
    searchGitHubProjects,
    searchLeetCodeProblems,
    searchOfficialDocs,
    searchDynamicRoadmapResources,
    processTurnInBackground,
    extractQuickFacts,
    // RAG — Chunker
    parseResumeHtml,
    parseRoadmap,
    parseJobDescription,
    // RAG — Embedder
    embedChunks,
    embedQuery,
    getCachedChunks,
    cacheChunks,
    invalidateChunkCache,
    getOrEmbedChunks,
    getOrEmbedRoadmapChunks,
    invalidateRoadmapChunkCache,
    getOrEmbedJdChunks,
    invalidateJdChunkCache,
    invalidateAllReportChunkCaches
};
