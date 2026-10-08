import knowledgeService from '../services/knowledgeService.js';

/**
 * ServiceDesk Pro — AI Triage & Recommendation Assistant
 *
 * Provides advisory category/priority suggestions and real-time knowledge base recommendations.
 * Suggestions are strictly advisory and user-controlled.
 */
export const aiAssistant = {
  /**
   * Analyzes ticket text to generate advisory classification suggestions.
   *
   * @param {string} title - Ticket subject
   * @param {string} description - Detailed problem description
   * @param {Array<Object>} categories - Organization categories
   * @returns {Object|null} Suggestion object or null if insufficient text
   */
  classifyTicket: (title = '', description = '', categories = []) => {
    const text = `${title} ${description}`.toLowerCase().trim();
    if (text.length < 5) return null;

    // 1. Detect Urgency & Priority
    let priority;
    let confidence;
    let diagnostic;

    const criticalKeywords = ['outage', 'system down', 'production down', 'security breach', 'emergency', 'data loss', 'all users'];
    const highKeywords = ['urgent', 'blocked', 'cannot work', 'broken', 'failing', 'deadline', 'crash', 'cannot login'];
    const lowKeywords = ['how to', 'request info', 'minor', 'question', 'feedback', 'setup guide', 'when possible'];

    if (criticalKeywords.some((kw) => text.includes(kw))) {
      priority = 'CRITICAL';
      confidence = 0.92;
      diagnostic = 'High-impact incident: potential service interruption or system outage';
    } else if (highKeywords.some((kw) => text.includes(kw))) {
      priority = 'HIGH';
      confidence = 0.85;
      diagnostic = 'High-urgency issue impacting daily productivity or authentication';
    } else if (lowKeywords.some((kw) => text.includes(kw))) {
      priority = 'LOW';
      confidence = 0.80;
      diagnostic = 'Informational request or standard non-blocking inquiry';
    } else {
      priority = 'MEDIUM';
      confidence = 0.78;
      diagnostic = 'Standard incident requiring triage and technician assignment';
    }

    // 2. Detect Category Match
    let matchedCategory = null;
    let matchedScore = 0;

    const domainKeywords = {
      network: ['vpn', 'wifi', 'internet', 'connection', 'dns', 'router', 'gateway', 'firewall', 'ip', 'offline'],
      hardware: ['laptop', 'macbook', 'dell', 'monitor', 'screen', 'keyboard', 'mouse', 'battery', 'charger', 'printer', 'cable'],
      software: ['outlook', 'email', 'teams', 'excel', 'slack', 'install', 'license', 'app', 'update', 'browser', 'chrome'],
      access: ['password', 'login', 'reset', 'mfa', '2fa', 'authenticator', 'locked', 'account', 'permission', 'credentials'],
    };

    categories.forEach((cat) => {
      const catName = cat.name.toLowerCase();
      let score = 0;

      // Exact or partial category name match
      if (text.includes(catName)) {
        score += 3;
      }

      // Domain keywords match
      Object.entries(domainKeywords).forEach(([domain, words]) => {
        if (catName.includes(domain)) {
          words.forEach((w) => {
            if (text.includes(w)) score++;
          });
        }
      });

      if (score > matchedScore) {
        matchedScore = score;
        matchedCategory = cat;
      }
    });

    // If no strong keyword match, pick first or null
    if (!matchedCategory && categories.length > 0) {
      matchedCategory = categories[0];
      confidence = Math.min(confidence, 0.65);
    }

    return {
      suggestedCategory: matchedCategory,
      suggestedPriority: priority,
      confidence,
      probableIssue: diagnostic,
    };
  },

  /**
   * Fetches real published solution articles matching the ticket text from the Knowledge Base.
   *
   * @param {string} queryText - Subject or issue query
   * @param {number} [limit=3] - Maximum recommendations to return
   * @returns {Promise<Array<Object>>} Matching articles
   */
  getRecommendedArticles: async (queryText = '', limit = 3) => {
    const cleanQuery = queryText.trim();
    if (cleanQuery.length < 3) return [];

    try {
      const res = await knowledgeService.getArticles({
        search: cleanQuery,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        limit,
      });

      if (res && res.success) {
        return res.data || [];
      }
    } catch (err) {
      console.error('Failed to retrieve knowledge base recommendations:', err);
    }

    return [];
  },
};

export const classifyTicket = aiAssistant.classifyTicket;
export const getRecommendedArticles = aiAssistant.getRecommendedArticles;

export default aiAssistant;
