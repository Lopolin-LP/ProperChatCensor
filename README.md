# Proper Chat Censor (alpha)
*A chat censoring engine built out of frustration, in typescript.*

## Why?
Roblox.

### Why? But like actually?
How is it possible that I can mix two alphabets and screw up Roblox's Chat Moderation? It can't be that hard to patch that??

# Goal
The goal isn't to capture everything. The goal is to make bypassing the filter look like gibberish and make the person look like a fool.

...but also keep the normal chat flow intact without random censors thrown in there.

# The Engine
`app.ts` is irrelevant, that is just for the web-frontend and configuring the engines.

`censor.ts` contains the framework. It's basically like a plugin system: Whenever a message needs censoring, the message is sent out as a string to all engines currently hooked into the censorer. Each engine writes it's own report for what it thinks is wrong with the message, where it's wrong, and what level of punishment to give. Engines can also say that specific parts are 100% fine, and overwrite the negative results of other engines or itself. All results are then combined, engines can optionally remove other reports if they know they're gonna be wrong, any whitelist-blacklist conflicts resolved (by removing all blacklists for each character where there is at least one whitelist), any now orphaned reports removed and then the censoring is applied.

This framework allows as you might guess for as many different engines to look at a message and complain in their own ways. There might be engines, checking for profanity bypasses based on unicode manipulation. Others might check for insults through context. The next one might be an LLM that does its own checks, who the hell knows what you're hooking up to it?

This should allow MAXIMUM flexibility with how the chat is censored. There is a roadmap, however if I feel like implementing it, is a different question.

# Roadmap
## Front-End usefulness
- [ ] Configure which engines are active
- [ ] Proper Penalty report (so the user sees what they're violating)
- [ ] Debug information (reports, matches, etc.)

## Back-End
- [ ] Metadata (User age, context, etc.)
- [ ] Proper Plugin system
  - Throw a `.ts` file or a folder in a plugin folder, upon compilation all of it integrated and accessible from the UI

## Default Engines
- [ ] Fix some issues with `simpleProfanity`
  - [ ] Check for spaces around word before censoring
  - [ ] add some extras for some word (grass)
  - [ ] make case insensitive
  - [ ] use `toLatin` and `toCyrillic`
    - [ ] and make use of symbols as replacement characters too
- [ ] Add a percentage based engine
  - [ ] Like how much of this word is it similar to a profanity word?

# Credits
- Englisch Profanity: https://github.com/coffee-and-fun/google-profanity-words/blob/main/data/en.txt
- Icon: No fucking clue, oh sorry I meant No \#\#\#\#\#\#\# clue