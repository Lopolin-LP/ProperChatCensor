import { censorEngine, censorMatch, engineResult } from "./censor.ts"

declare global {
    interface RegExpConstructor {
        escape(str: string): string;
    }
}

type alphabetJson = {
    similar: string[]
    latin: string
    cyrillic: string
    latinToCyrillic: string
}

type regexProxyTrap = {[index: string]: () => RegExp}
type regexProxyStore = {[index: string]: RegExp}

class simpleProfanity implements censorEngine {
    toLatinAlphabet: Map<string, string>
    profanity: {[index: string]: {[index: string]: number}};
    notProfanity: {[index: string]: string[]};
    profanityRegex: regexProxyTrap;
    notProfanityRegex: regexProxyTrap;
    constructor(config: {alphabetJson: alphabetJson, en: string, en_white: string}) {
        const { alphabetJson } = config;
        const similarAlphabet: string[] = alphabetJson.similar;
        // Latin
        const latinAlphabet: string[] = alphabetJson.latin.split('');
        this.toLatinAlphabet = new Map();
        similarAlphabet.forEach(group => {
            const foundLetter = (() => {
                for (const letter in latinAlphabet) {
                    if (group.search(letter) !== -1) return letter;
                }
                return '';
            })();
            group.split('').forEach(v => this.toLatinAlphabet.set(v, foundLetter));
        });


        // PROFANITY
        this.profanity = {};
        this.notProfanity = {};

        const profanityRegexHandler: ProxyHandler<{[index: string]: RegExp}> = {
            get(t, p: string, r): () => RegExp {
                const flagsSet = new Set(t[p].flags.split(''));
                flagsSet.add('g');
                flagsSet.add('d');
                return () => new RegExp(t[p], Array.from(flagsSet).join('')); // Set d flag for indices
            },
            set(t, p: string, v) {
                t[p] = v;
                return true;
            }
        };

        // This mess ensures that a freshly baked RegExp is given, so it doesn't modify the old ones.
        let profanityRegexStore: regexProxyStore = {}
        let notProfanityRegexStore: regexProxyStore = {}
        this.profanityRegex = new Proxy(profanityRegexStore, profanityRegexHandler) as unknown as regexProxyTrap;
        this.notProfanityRegex = new Proxy(notProfanityRegexStore, profanityRegexHandler) as unknown as regexProxyTrap;
        // English
        this.profanity.en = config.en.split('\n').reduce((p, v) => ({...p, [v]: 1}), {}); // All words are penalty 1
        profanityRegexStore.en = simpleProfanity.regexTxtFile(config.en);
        this.notProfanity.en = config.en_white.split('\n');
        notProfanityRegexStore.en = simpleProfanity.regexTxtFile(config.en_white);
    }
    /**
     * Makes a txt file input, where each match is on a new line, a Regex.
     * @param txt 
     */
    static regexTxtFile(txt: string): RegExp {
        return new RegExp(txt.split('\n').map(v => RegExp.escape(v)).join('|'));
    }
    run(msg: string) {
        return new engineResult(msg, [
            ...this.simpleRegexToMatch(this.profanityRegex.en(), msg, {type: "blacklist", severityLookup: this.profanity.en}),
            ...this.simpleRegexToMatch(this.notProfanityRegex.en(), msg, {type: "whitelist"})
        ]);
    }
    toLatin(msg: string) {
        return msg.split('').map(v => this.toLatinAlphabet.get(v) ?? v).join('');
    }
    simpleRegexToMatch(regex: RegExp, msg: string, config: {type: InstanceType<typeof censorMatch>['type'], severityLookup?: {[i: string]: number}} = {type: 'blacklist', severityLookup: undefined}): censorMatch[] {
        let array: RegExpExecArray | null;
        const censorMatchList = [];
        let iterations = 0;
        while ((array = regex.exec(msg)) !== null) {
            // https://stackoverflow.com/questions/3895478/does-javascript-have-a-method-like-range-to-generate-a-range-within-the-supp#comment58731831_29559488
            const matchArea = Array(array[0].length).fill(undefined).map((_, i) => i + (array?.index ?? 0));
            censorMatchList.push(new censorMatch({
                at: matchArea,
                identifier: 'simpleProfanity',
                reason: config.type === 'whitelist' ? 'Not Profanity' : 'Profanity',
                severity: config.severityLookup?.[array[0]] ?? 0,
                type: config.type
            }));
            iterations++
            if (iterations > 1000) {
                throw Error('Passed 1000 iterations, this is not healthy.');
            }
        }
        return censorMatchList;
    }
}

export { simpleProfanity }