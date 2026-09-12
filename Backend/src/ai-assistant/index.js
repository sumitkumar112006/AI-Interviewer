const { streamAssistantChat, processAssistantChat, detectToolRequirement, extractSnippetFromReply } = require('./assistant.orchestrator');
const { assembleContext, getRecentChatHistory, getCandidateMemoryProfile, appendChatTurn } = require('./contextAssembler');
const { searchWeb, searchLearningResources } = require('./searchTool.service');
const { processTurnInBackground, extractQuickFacts } = require('./memoryExtractor');

module.exports = {
    streamAssistantChat,
    processAssistantChat,
    detectToolRequirement,
    extractSnippetFromReply,
    assembleContext,
    getRecentChatHistory,
    getCandidateMemoryProfile,
    appendChatTurn,
    searchWeb,
    searchLearningResources,
    processTurnInBackground,
    extractQuickFacts
};
