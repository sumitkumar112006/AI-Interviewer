const { streamAssistantChat, processAssistantChat, buildAssistantPromptAndMessages, detectToolRequirement, extractSnippetFromReply } = require('./assistant.orchestrator');
const { classifyIntent, classifyIntentTier1, classifyIntentTier2 } = require('./intentClassifier');
const { loadDynamicContext } = require('./dynamicContextLoader');
const { assembleContext, getRecentChatHistory, getCandidateMemoryProfile, appendChatTurn, extractCompactJdSummary } = require('./contextAssembler');
const { searchWeb, searchLearningResources } = require('./searchTool.service');
const { processTurnInBackground, extractQuickFacts } = require('./memoryExtractor');

module.exports = {
    streamAssistantChat,
    processAssistantChat,
    buildAssistantPromptAndMessages,
    detectToolRequirement,
    extractSnippetFromReply,
    classifyIntent,
    classifyIntentTier1,
    classifyIntentTier2,
    loadDynamicContext,
    assembleContext,
    getRecentChatHistory,
    getCandidateMemoryProfile,
    appendChatTurn,
    extractCompactJdSummary,
    searchWeb,
    searchLearningResources,
    processTurnInBackground,
    extractQuickFacts
};
