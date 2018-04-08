# Tupperware
A Discord bot written in <a href="https://github.com/abalabahaha/eris">eris</a> for proxying user messages through webhooks to emulate tulpas/systems users having their own user accounts.

# Commands
- tul!help  -  Print help message, or get help for a specific command
- tul!hook  -  Attach a webhook to a channel, allowing tulpas to talk in it
- tul!unhook  -  Remove previously added tulpa webhooks
- tul!register  -  Register a new tulpa
- tul!remove  -  Unregister a tulpa
- tul!list  -  Get a detailed list of yours or another user's registered tulpas
- tul!rename  -  Change a tulpa's name
- tul!avatar  -  View or change a tulpa's avatar
- tul!describe  -  View or change a tulpa's description
- tul!birthday  -  View or change a tulpa's birthday, or see upcoming birthdays
- tul!brackets  -  View or change a tulpa's brackets
- tul!tag  -  Remove or change a tulpa's tag (displayed next to their name)
- tul!showhost  -  Show the user that registered the tulpa that last spoke
- tul!find  -  Find and display info about tulpas by name
- tul!invite  -  Get the bot's invite URL
- tul!feedback  -  Send a message to the developer, who may reply through the bot
- tul!cfg  -  Configure server-specific settings

# Installation
This bot runs off of Node.js. You can download it from https://nodejs.org/en/download/

Once node is installed, run `npm install` from the bot directory to install the bot's dependencies. If the dependencies all install successfully (note: you may have to run `npm -g install windows-build-tools` first) then you can now run the bot by running `node bot`.

# Running
Initially the bot will generate an empty `auth.json` file and likely throw an error. You need to put the bot's token and your userID in this auth.json file for the bot to work properly. Format should look like this:
```json
{
	"discord": "MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs",
	"owner": "99326032288423936"
}```
(don't worry, that token is the one Discord publishes on its API docs)