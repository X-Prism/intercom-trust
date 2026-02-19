import {Protocol} from "trac-peer";

class TrustProtocol extends Protocol{
    constructor(peer, base, options = {}) {
        super(peer, base, options);
    }

    async extendApi(){
        this.api.getTrustInfo = function(){
            return 'Intercom Trust — P2P Reputation System v0.1.0';
        }
    }

    mapTxCommand(command){
        let obj = { type: '', value: null };

        // Simple string commands (no JSON)
        if (command === 'get_leaderboard') {
            obj.type = 'getLeaderboard';
            obj.value = { op: 'get_leaderboard', limit: 10 };
            return obj;
        }

        // JSON command routing
        const json = this.safeJsonParse(command);
        if (json?.op !== undefined) {
            if (json.op === 'rate')            { obj.type = 'submitRating';     obj.value = json; return obj; }
            if (json.op === 'respond')         { obj.type = 'submitResponse';   obj.value = json; return obj; }
            if (json.op === 'register')        { obj.type = 'registerProfile';  obj.value = json; return obj; }
            if (json.op === 'get_summary')     { obj.type = 'getRatingSummary'; obj.value = json; return obj; }
            if (json.op === 'get_reviews')     { obj.type = 'getReviews';       obj.value = json; return obj; }
            if (json.op === 'get_profile')     { obj.type = 'getProfile';       obj.value = json; return obj; }
            if (json.op === 'get_leaderboard') { obj.type = 'getLeaderboard';   obj.value = json; return obj; }
        }

        return null;
    }

    async printOptions(){
        console.log(' ');
        console.log('- Trust Commands:');
        console.log('- /rate --address "<trac1...>" --score <1-5> [--comment "text"] | Rate a peer.');
        console.log('- /trust --address "<trac1...>" | Check a peer\'s reputation summary.');
        console.log('- /reviews --address "<trac1...>" [--limit N] [--offset N] | View reviews for a peer.');
        console.log('- /top [--limit N] | Show the reputation leaderboard.');
        console.log('- /respond --rater "<trac1...>" --comment "text" | Respond to a rating you received.');
        console.log('- /register --alias "name" | Register a display name for yourself.');
        console.log('- /whois --address "<trac1...>" | Look up a peer\'s profile.');
        console.log('- /get --key "<key>" [--confirmed true|false] | Read contract state key.');
    }

    async customCommand(input) {
        await super.tokenizeInput(input);

        if (this.input.startsWith("/rate")) {
            const args = this.parseArgs(input);
            const address = args.address || args.addr || args.peer;
            const scoreRaw = args.score || args.s;
            const comment = args.comment || args.c || '';

            if (!address || !scoreRaw) {
                console.log('Usage: /rate --address "<trac1...>" --score <1-5> [--comment "text"]');
                return;
            }

            const score = parseInt(scoreRaw, 10);
            if (isNaN(score) || score < 1 || score > 5) {
                console.log('Score must be an integer between 1 and 5.');
                return;
            }

            const cmd = JSON.stringify({ op: 'rate', ratee: String(address), score, comment: String(comment) });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/trust")) {
            const args = this.parseArgs(input);
            const address = args.address || args.addr || args.peer;

            if (!address) {
                console.log('Usage: /trust --address "<trac1...>"');
                return;
            }

            const cmd = JSON.stringify({ op: 'get_summary', address: String(address) });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/reviews")) {
            const args = this.parseArgs(input);
            const address = args.address || args.addr || args.peer;
            const limit = args.limit ? parseInt(args.limit, 10) : 20;
            const offset = args.offset ? parseInt(args.offset, 10) : 0;

            if (!address) {
                console.log('Usage: /reviews --address "<trac1...>" [--limit N] [--offset N]');
                return;
            }

            const cmd = JSON.stringify({ op: 'get_reviews', address: String(address), limit, offset });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/top")) {
            const args = this.parseArgs(input);
            const limit = args.limit ? parseInt(args.limit, 10) : 10;

            const cmd = JSON.stringify({ op: 'get_leaderboard', limit });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/respond")) {
            const args = this.parseArgs(input);
            const rater = args.rater || args.rater_address || args.from;
            const comment = args.comment || args.c;

            if (!rater || !comment) {
                console.log('Usage: /respond --rater "<trac1...>" --comment "text"');
                return;
            }

            const cmd = JSON.stringify({ op: 'respond', rater_address: String(rater), comment: String(comment) });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/register")) {
            const args = this.parseArgs(input);
            const alias = args.alias || args.name || args.nick;

            if (!alias) {
                console.log('Usage: /register --alias "name"');
                return;
            }

            const cmd = JSON.stringify({ op: 'register', alias: String(alias) });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/whois")) {
            const args = this.parseArgs(input);
            const address = args.address || args.addr || args.peer;

            if (!address) {
                console.log('Usage: /whois --address "<trac1...>"');
                return;
            }

            const cmd = JSON.stringify({ op: 'get_profile', address: String(address) });
            await this.peer.protocol.instance.api.tx(cmd);
            return;
        }

        if (this.input.startsWith("/get")) {
            const m = input.match(/(?:^|\s)--key(?:=|\s+)(\"[^\"]+\"|'[^']+'|\S+)/);
            const raw = m ? m[1].trim() : null;
            if (!raw) {
                console.log('Usage: /get --key "<hyperbee-key>" [--confirmed true|false]');
                return;
            }
            const key = raw.replace(/^\"(.*)\"$/, "$1").replace(/^'(.*)'$/, "$1");
            const confirmedMatch = input.match(/(?:^|\s)--confirmed(?:=|\s+)(\S+)/);
            const unconfirmedMatch = input.match(/(?:^|\s)--unconfirmed(?:=|\s+)?(\S+)?/);
            const confirmed = unconfirmedMatch ? false : confirmedMatch ? confirmedMatch[1] === "true" || confirmedMatch[1] === "1" : true;
            const v = confirmed ? await this.getSigned(key) : await this.get(key);
            console.log(v);
            return;
        }
    }
}

export default TrustProtocol;
