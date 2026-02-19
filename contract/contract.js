import {Contract} from 'trac-peer'

class TrustContract extends Contract {
    constructor(protocol, options = {}) {
        super(protocol, options);

        // --- Write operations (schema-validated) ---

        this.addSchema('submitRating', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                ratee: { type: "string", min: 1, max: 128 },
                score: { type: "number", integer: true, min: 1, max: 5 },
                comment: { type: "string", max: 280, optional: true, default: "" }
            }
        });

        this.addSchema('submitResponse', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                rater_address: { type: "string", min: 1, max: 128 },
                comment: { type: "string", min: 1, max: 280 }
            }
        });

        this.addSchema('registerProfile', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                alias: { type: "string", min: 1, max: 64 }
            }
        });

        // --- Read operations (schema-validated) ---

        this.addSchema('getRatingSummary', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                address: { type: "string", min: 1, max: 128 }
            }
        });

        this.addSchema('getReviews', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                address: { type: "string", min: 1, max: 128 },
                limit: { type: "number", integer: true, min: 1, max: 100, optional: true, default: 20 },
                offset: { type: "number", integer: true, min: 0, optional: true, default: 0 }
            }
        });

        this.addSchema('getProfile', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                address: { type: "string", min: 1, max: 128 }
            }
        });

        this.addSchema('getLeaderboard', {
            value: {
                $$strict: true,
                $$type: "object",
                op: { type: "string", min: 1, max: 128 },
                limit: { type: "number", integer: true, min: 1, max: 50, optional: true, default: 10 }
            }
        });

        // --- Timer feature (same pattern as upstream) ---

        const _this = this;

        this.addSchema('feature_entry', {
            key: { type: "string", min: 1, max: 256 },
            value: { type: "any" }
        });

        this.addFeature('timer_feature', async function(){
            if(false === _this.check.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'currentTime') {
                if(null === await _this.get('currentTime')) console.log('timer started at', _this.op.value);
                await _this.put(_this.op.key, _this.op.value);
            }
        });
    }

    // ==================== WRITE OPERATIONS ====================

    async submitRating() {
        const rateeAddr = this.value.ratee;
        const raterAddr = this.address;
        const score = this.value.score;

        // Validation
        this.assert(typeof rateeAddr === 'string' && rateeAddr.length > 0, new Error('Invalid ratee address'));
        this.assert(raterAddr !== rateeAddr, new Error('Cannot rate yourself'));
        this.assert(score >= 1 && score <= 5, new Error('Score must be 1-5'));

        // Reads
        const existingRating = await this.get('rating:' + rateeAddr + ':' + raterAddr);
        const summary = await this.get('summary:' + rateeAddr) || {
            totalScore: 0, count: 0, avgScore: 0, lastRated: null, raters: []
        };
        const peersList = await this.get('peers_list') || [];
        const currentTime = await this.get('currentTime');

        // Compute updated summary
        const cloned = this.protocol.safeClone(summary);

        if (existingRating) {
            cloned.totalScore = cloned.totalScore - existingRating.score + score;
        } else {
            cloned.totalScore += score;
            cloned.count += 1;
            if (!cloned.raters.includes(raterAddr)) {
                cloned.raters.push(raterAddr);
            }
        }
        cloned.avgScore = cloned.count > 0 ? cloned.totalScore / cloned.count : 0;
        cloned.lastRated = currentTime ?? null;

        // Puts (all at end)
        await this.put('rating:' + rateeAddr + ':' + raterAddr, {
            score,
            comment: this.value.comment || '',
            timestamp: currentTime ?? null
        });
        await this.put('summary:' + rateeAddr, cloned);
        if (!peersList.includes(rateeAddr)) {
            await this.put('peers_list', [...peersList, rateeAddr]);
        }

        console.log('TRUST_RESULT:' + JSON.stringify({
            op: 'submitRating',
            rater: raterAddr,
            ratee: rateeAddr,
            score,
            updated: !!existingRating
        }));
    }

    async submitResponse() {
        const rateeAddr = this.address;
        const raterAddr = this.value.rater_address;

        this.assert(typeof raterAddr === 'string' && raterAddr.length > 0, new Error('Invalid rater address'));

        const rating = await this.get('rating:' + rateeAddr + ':' + raterAddr);
        this.assert(rating !== null, new Error('No rating found to respond to'));

        const currentTime = await this.get('currentTime');

        await this.put('response:' + rateeAddr + ':' + raterAddr, {
            comment: this.value.comment,
            timestamp: currentTime ?? null,
            ratingTimestamp: rating.timestamp ?? null
        });

        console.log('TRUST_RESULT:' + JSON.stringify({
            op: 'submitResponse',
            ratee: rateeAddr,
            rater: raterAddr
        }));
    }

    async registerProfile() {
        const currentTime = await this.get('currentTime');

        await this.put('profile:' + this.address, {
            alias: this.value.alias,
            registered: currentTime ?? null
        });

        console.log('TRUST_RESULT:' + JSON.stringify({
            op: 'registerProfile',
            address: this.address,
            alias: this.value.alias
        }));
    }

    // ==================== READ OPERATIONS ====================

    async getRatingSummary() {
        const addr = this.value.address;
        const summary = await this.get('summary:' + addr);

        if (!summary) {
            console.log('TRUST_RESULT:' + JSON.stringify({
                address: addr,
                found: false
            }));
            return;
        }

        const profile = await this.get('profile:' + addr);

        console.log('TRUST_RESULT:' + JSON.stringify({
            address: addr,
            alias: profile?.alias || null,
            totalScore: summary.totalScore,
            count: summary.count,
            avgScore: Math.round(summary.avgScore * 100) / 100,
            lastRated: summary.lastRated
        }));
    }

    async getReviews() {
        const addr = this.value.address;
        const limit = Math.min(this.value.limit || 20, 100);
        const offset = this.value.offset || 0;

        const summary = await this.get('summary:' + addr);
        if (!summary || !summary.raters || summary.raters.length === 0) {
            console.log('TRUST_RESULT:' + JSON.stringify({
                address: addr,
                reviews: [],
                total: 0
            }));
            return;
        }

        const raters = summary.raters;
        const total = raters.length;
        const slice = raters.slice(offset, offset + limit);

        const reviews = [];
        for (const raterAddr of slice) {
            const rating = await this.get('rating:' + addr + ':' + raterAddr);
            if (rating) {
                const response = await this.get('response:' + addr + ':' + raterAddr);
                const raterProfile = await this.get('profile:' + raterAddr);
                reviews.push({
                    rater: raterAddr,
                    raterAlias: raterProfile?.alias || null,
                    score: rating.score,
                    comment: rating.comment,
                    timestamp: rating.timestamp,
                    response: response ? response.comment : null
                });
            }
        }

        console.log('TRUST_RESULT:' + JSON.stringify({
            address: addr,
            reviews,
            total,
            offset,
            limit
        }));
    }

    async getProfile() {
        const addr = this.value.address;
        const profile = await this.get('profile:' + addr);
        const summary = await this.get('summary:' + addr);

        console.log('TRUST_RESULT:' + JSON.stringify({
            address: addr,
            alias: profile?.alias || null,
            registered: profile?.registered || null,
            avgScore: summary ? Math.round(summary.avgScore * 100) / 100 : null,
            ratingCount: summary?.count || 0
        }));
    }

    async getLeaderboard() {
        const limit = Math.min(this.value.limit || 10, 50);

        const peersList = await this.get('peers_list') || [];
        if (peersList.length === 0) {
            console.log('TRUST_RESULT:' + JSON.stringify({
                leaderboard: [],
                total: 0
            }));
            return;
        }

        const entries = [];
        for (const addr of peersList) {
            const summary = await this.get('summary:' + addr);
            if (summary && summary.count > 0) {
                entries.push({
                    address: addr,
                    avgScore: Math.round(summary.avgScore * 100) / 100,
                    count: summary.count
                });
            }
        }

        entries.sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

        const top = entries.slice(0, limit);
        for (const entry of top) {
            const profile = await this.get('profile:' + entry.address);
            entry.alias = profile?.alias || null;
        }

        console.log('TRUST_RESULT:' + JSON.stringify({
            leaderboard: top,
            total: entries.length
        }));
    }
}

export default TrustContract;
