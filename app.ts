import { censor, censorEngine } from "./censor.ts";
import { simpleProfanity } from "./defaultEngine.ts";

var elms_mappings: {[key: string]: any} = {};
const empty_html = "<span class='empty'>No preview available.</span>";

// Make it easier to access elements
type elmstype = {[key: string]: HTMLElement & HTMLInputElement};
var elms = new Proxy(<elmstype>{}, {
    get: function (t, p: string,): any {
        let query = elms_mappings?.[p] ?? p;
        return typeof query === "string" ? document.querySelector(query) : query ?? null;
    }
});

// Log Management
const logs = {
    addEntry: function () {
        const logentry = document.createElement("p");
        logentry.innerText = (elms.output).innerText;
        elms.logs.append(logentry);
        elms.output.innerHTML = empty_html;
        elms.message.value = "";
    }
}

function scrollToBottom() {
    elms.logs.scrollTo(0, (<HTMLElement>elms.logs.lastElementChild)?.offsetTop ?? 0);
}
function scrollSmooth() {
    document.body.classList.add("smooth-scroll");
}

var bigCensor: censor;
(async () => {
    const alphabetJson = await (await fetch('./data/alphabet.json')).json();
    const enText = await (await fetch('./data/en.txt')).text();
    const enWhiteText = await (await fetch('./data/en_white.txt')).text();
    bigCensor = new censor([
        {
            coe: simpleProfanity,
            /** @type {Parameters<simpleProfanity>} */
            config: {
                alphabetJson: alphabetJson,
                en: enText,
                en_white: enWhiteText
            } satisfies ConstructorParameters<typeof simpleProfanity>[0]
        }
    ]);
})();

function convertMessage(e: KeyboardEvent) {
    const message = elms.message.value ?? null;
    const result = bigCensor.run(message);
    const filtered_message = bigCensor.runMask(result);
    filtered_message === "" ? elms.output.innerHTML = empty_html : elms.output.innerText = filtered_message;
    if (e.key == "Enter") {
        logs.addEntry();
        scrollToBottom();
    }
}
function setInput(msg: string) {
    elms.message.value = msg;
}
function getInput() {
    return elms.message.value;
}
class messageHistory {
    constructor() {}
    log: string[] = [];
    cache: string = '';
    previous() {
        if (this.currentlyAt < this.log.length-1) {
            this.currentlyAt++
        }
        return this.get();
    }
    next() {
        if (this.currentlyAt > 0) {
            this.currentlyAt--
            return this.get();
        } else {
            this.currentlyAt = -1;
            return this.cache;
        }
    }
    get() {
        return this.log[this.currentlyAt];
    }
    add(msg: string) {
        this.log.unshift(msg);
        this.currentlyAt = -1;
        this.cache = '';
    }
    cacheIfNeeded(msg: string) {
        if (this.currentlyAt < 0) {
            this.cache = msg;
        }
    }
    currentlyAt = -1;
}

var typingtimeout: number|null = null;
window.addEventListener("load", () => {
    // Setup Elms
    elms_mappings = {
        main: "#main",
        message: <HTMLInputElement>document.querySelector("#message"),
        output: "#output",
        logs: "#msglog"
    };
    // Setup automatic string censor
    function finishTimeout(e: KeyboardEvent) {
        convertMessage(e);
        typingtimeout = null;
    }
    const msghist = new messageHistory();
    elms.main?.addEventListener("keydown", e => {
        msghist.cacheIfNeeded(getInput());
        switch (e.key) {
            case 'ArrowUp':
                setInput(msghist.previous());
                break;
            case 'ArrowDown':
                setInput(msghist.next());
                break;
        
            default:
                break;
        }
    })
    elms.main?.addEventListener("keyup", e => {
        if (typingtimeout) {
            clearTimeout(typingtimeout);
        }
        if (e.key === "Enter") {
            msghist.add(getInput());
            finishTimeout(e);
            return;
        }
        typingtimeout = setTimeout(() => {finishTimeout(e)}, 500);
    });
    elms.output.innerHTML = empty_html;
    scrollToBottom();
    scrollSmooth();
});

function addSampleTextToLog(number = 20) {
    document.getElementById('msglog')?.append(...Array(number).fill(undefined).map(() => {
        const elm = document.createElement('p');
        elm.innerText='Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam reprehenderit odio fugiat, quidem atque ratione magnam nesciunt eveniet dolore adipisci suscipit minus cupiditate?';
        return elm;
    }))
    scrollToBottom();
    scrollSmooth();
}

(window as any).addSampleTextToLog = addSampleTextToLog;