/**
 * @file controlledPenalty.js
 * @module services/ats/scoring/controlledPenalty
 *
 * Implements a bounded, proportional deficit penalty for missing mandatory requirements.
 * Replaces aggressive exponential multiplication with a calibrated penalty curve (max 0.45).
 */

'use strict';

/**
 * Calculates a controlled, bounded penalty factor for missing or partial mandatory requirements.
 *
 * @param {Array<Object>} mandatoryMatches - Matches for requirements marked as isMandatory: true
 * @returns {number} Penalty fraction between 0.00 and 0.45
 */
function calculateControlledPenalty(mandatoryMatches = []) {
    if (!mandatoryMatches || mandatoryMatches.length === 0) return 0.0;

    let totalDeficit = 0;
    let totalWeight = 0;

    for (const match of mandatoryMatches) {
        // Critical requirements weigh 1.5x, High weighs 1.2x, others 1.0x
        let weight = 1.0;
        if (match.criticality === 'CRITICAL') weight = 1.5;
        else if (match.criticality === 'HIGH') weight = 1.2;

        totalWeight += weight;

        // Deficit: 1.0 - achievedScore (0.0 means fully met, 1.0 means completely missing)
        const deficit = Math.max(0, 1.0 - (match.score || 0));
        totalDeficit += deficit * weight;
    }

    if (totalWeight === 0) return 0.0;

    const normalizedDeficitRatio = totalDeficit / totalWeight;

    // Maximum penalty is bounded at 45% (0.45)
    // Prevents score collapse when 1-2 non-critical items are missed
    const penalty = Math.min(0.45, normalizedDeficitRatio * 0.45);

    return Number(penalty.toFixed(4));
}

module.exports = { calculateControlledPenalty };

