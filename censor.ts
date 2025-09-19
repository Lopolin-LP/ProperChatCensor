// Idea: Multiple "Engines" that each do their own comparison things.

/** Random, time-based, 16 chars */
const uid = function(): string {
    // https://stackoverflow.com/a/53116778
    return Date.now().toString(36).padStart(6, "0").slice(-6) + Math.random().toString(36).slice(2).padStart(10, "0").slice(-10);
}


/*

ENGINE RESULTS

This is every engines report paper to fill out. The main censoring utility will use this to evaluate the proper punishments AND what to censor.

*/


type engineIdentifier = string;
type mask = boolean[];

/** Result paper for Engines */
class censorMatch {
    /** Debug purposes only */
    public readonly id: string;

    /** Type of Match */
    public readonly type: "whitelist"|"blacklist" = 'blacklist';
    /** Severity, check docs for which numbers to use */
    public readonly severity: number = 0;
    /** Used to re-identify a match from a specific engine or specific part of it. Can be used by other engines to "overwrite" a result. */
    public readonly identifier: engineIdentifier = 'placeholder';
    /** This function will be run with previous censorMatches as the parameter. Returned result must include all censorMatches that should be kept IN ORDER. If set to `undefined` or returned, no changes will be made. */
    public readonly overwrite?: ((...previousMatches: censorMatch[]) => censorMatch[] | undefined) | undefined = undefined;
    /** Reason for which this penalty was given */
    public readonly reason: string = 'No reason specified';

    /** Positions that this match applies to. NOTE: Masks may be modified and won't include every position. */
    public readonly at: number[] = [];

    constructor(config: Omit<censorMatch, 'id'>) {
        this.id = uid(); // Just for debugging, has no other purpose yet
        Object.assign(this, config);
        if (this.identifier === 'placeholder') {
            throw new Error("Placeholders not allowed");
        }
    }
}

type penalty = {
    text: string;
    mask: mask;
    reasons: string[];
    severity: number;
};

class engineResult {
    public mask: censorMatch[][];
    public matches: censorMatch[];
    public readonly text: string;
    constructor(text: string, matches: censorMatch[]) {
        this.mask = Array(text.length).fill(undefined).map(_ => ([])); // We remap this because fill fills references, not copies
        this.matches = matches;
        this.text = text;

        // Matches At Positions to the masks positions
        matches.forEach((match) => {
            match.at.forEach((pos) => {
                this.mask[pos].push(match);
            });
        });
    }
    /** Add more engineResults to this result */
    addResult(...moreEngineResults: engineResult[]): typeof this {
        moreEngineResults.forEach(result => {
            result.mask.forEach((v, i) => this.mask[i].push(...v));
            this.matches.push(...result.matches);
        })
        return this;
    }
    /** Run all Overwrite functions and apply them */
    applyOverwrites(): typeof this {
        this.mask.forEach(maskEntry => {
            let queue: censorMatch[] = [];
            for (const match of maskEntry) {
                queue = match.overwrite?.(...queue) ?? queue;
            }
        });
        return this;
    }
    /** Check for whitelists and remove all blacklist penalties in each mask entry if there is a single whitelist */
    applyWhitelists(): typeof this {
        this.mask = this.mask.map((maskEntry) => {
            const whitelists = maskEntry.filter(v => v.type === 'whitelist');
            switch (whitelists.length) {
                case 0:
                    return maskEntry; // No Whitelists
            
                default:
                    return whitelists; // At least one Whitelist
            }
        });
        return this;
    }
    /** Remove matches not present in the mask. */
    removeOrphans(): typeof this {
        let maskMatches = new Set(this.mask.reduce((p, c) => [...p, ...c], []));
        this.matches = this.matches.filter(v => maskMatches.has(v)); // Note: Not using built-in Intersection function of Set due to order of elements getting potentially messed up
        return this;
    }
    /** Run a few functions usually ran before anything else, just for cleanup. */
    cleanUp(): typeof this {
        this.applyOverwrites();
        this.applyWhitelists();
        this.removeOrphans();
        return this;
    }
    /** This returns an object that contains the final penalties, and a boolean-based mask. */
    toPenalty(): penalty {
        this.cleanUp();
        // TODO
        /*
        This makes a new object that contains the final penalties (simply take this.matches), and a boolean-based mask (go through this.mask).
        note: severity = "highest severity of all" + Math.floor( "all other severeties added up" / ( 2.5 * "highest severity of all" ) )
        note: maybe some logarithm in the severity? or to the power of x?
        */
        const { highest_severity, severity_sum } = (() => {
            let highest_severity = 0;
            let severities_added = 0;
            this.matches.forEach(match => {
                const current_severity = match.severity;
                if (current_severity > highest_severity) highest_severity = current_severity;
                severities_added += current_severity;
            });
            return {
                highest_severity: highest_severity,
                severity_sum: severities_added
            };
        })();
        
        return {
            // We can save ourselves some work here, as whitelists and blacklists cannot be mixed
            mask: this.mask.map(v => {
                if (v.length === 0) {
                    return true;
                }
                if (v[0].type === 'whitelist') {
                    return true;
                }
                return false;
            }),
            reasons: this.matches.reduce((p: string[], v: censorMatch) => ([...p, v.reason]), []),
            text: this.text,
            // Severity is in GeoGebra: If(a_{1} ≤ x, a_{1} + 1 / 10 (x - a_{1})²)
            // where a_{1} represents the highest severity and the x-Axis the severity sum
            severity: highest_severity === 0 ? 0 : highest_severity + Math.floor(0.1 * Math.pow(severity_sum - highest_severity, 2))
        }
    }
}

/** Blueprint for what an engine needs */
interface censorEngine {
    /**
     * Run Engine on a message
     * @returns 
     */
    run: (msg: string) => engineResult
}
interface censorEngineConstructor {
    new (config?: any): censorEngine
}
/*

MAIN CENSORING

this class makes EVERYTHING work.
You create it by defining all the engines you want to use and their configurations.
Then you throw your string at the run function, and run it through the apply function and spit that out to the user.

*/

class censor { // AI: Claude helped fix up this extension and config of coe mess.
    public engines: censorEngine[] = []
    /** Censor configuration */
    readonly config = {
        /** Character used to replace characters with when masking them */
        censorChar: '#'
    }
    /**
     * Setup Censoring Instance with any amount of engines and configs necessary.
     * @param enginesAndConfig COE: Class of Engine. Config: Whatever the config of that censorEngine is.
     */
    constructor(enginesAndConfig: {coe: censorEngineConstructor, config: unknown}[], config?: Partial<typeof this.config>) {
        if (config) {
            Object.assign(this.config, config)
        }
        for (let i = 0; i < enginesAndConfig.length; i++) {
            const engine = enginesAndConfig[i];
            this.engines.push(new engine.coe(engine.config));
        }
    }
    /**
     * Run the filtering engines and get a full penalty report back.
     */
    run(msg: string): penalty {
        let allReports = this.engines.map((v) => v.run(msg));
        if (allReports.length === 0) {
            return {
                text: msg,
                mask: Array(msg.length).fill(false),
                reasons: [],
                severity: 0
            }
        }
        // @ts-expect-error We check above if allReports has at least ONE entry
        const all: engineResult = allReports.pop()?.addResult(...allReports);
        return all.toPenalty();
    }
    runMask(pen: penalty): string {
        return censor.apply(pen.text, pen.mask, this.config.censorChar);
    }
    /**
     * Use a mask from a penalty to censor a message
     * @param msg The message to mask
     * @param mask The mask to apply on the message. Any position evaluation to `true` will be masked
     */
    static apply(msg: string, mask: mask, censorChar: string = '#'): string {
        if (msg.length !== mask.length) throw new Error("Mask does not match Message length");
        const msgArr = msg.split('');
        return mask.map((v, i) => v ? msgArr[i] : censorChar).join('');
    }
}

/*

EXPORTS

*/

export { censor, censorEngine, censorMatch, engineResult }