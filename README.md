# Tupperware
A Discord bot written in <a href="https://github.com/abalabahaha/eris">eris</a> for proxying user messages through webhooks to emulate tulpas/systems users having their own user accounts.

# Commands
- tul!help  -  Print this message, or get help for a specific command
- tul!register  -  Register a new tulpa
- tul!remove  -  Unregister a tulpa
- tul!list  -  Get a detailed list of yours or another user's registered tulpas
- tul!rename  -  Change a tulpa's name
- tul!avatar  -  View or change a tulpa's avatar
- tul!describe  -  View or change a tulpa's description
- tul!birthday  -  View or change a tulpa's birthday, or see upcoming birthdays
- tul!brackets  -  View or change a tulpa's brackets
- tul!tag  -  Remove or change a tulpa's or your user tag (displayed next to name when proxying)
- tul!showuser  -  Show the user that registered the tulpa that last spoke
- tul!find  -  Find and display info about tulpas by name
- tul!invite  -  Get the bot's invite URL
- tul!feedback  -  Send a message to the developer, who may reply through the bot
- tul!cfg  -  Configure server-specific settings
  - tul!cfg prefix \<newPrefix> - Change the bot's prefix
  - tul!cfg roles <enable|disable> - Enable or disable automatically managed mentionable tulpa roles, so that users can mention tulpas
  - tul!cfg rename \<newname> - Change all instances of the default name 'tulpa' in bot replies in this server to the specified term
  - tul!cfg log \<channel> - Enable the bot to send a log of all tulpa messages and some basic info like who registered them. Useful for having a searchable channel and for distinguishing between similar names.
  - tul!cfg blacklist <add|remove> <channel(s)> - Add or remove channels to the bot's proxy blacklist - users will be unable to proxy in blacklisted channels.
  - tul!cfg cmdblacklist <add|remove> <channel(s)> - Add or remove channels to the bot's command blacklist - users will be unable to issue commands in blacklisted channels.

# Installation
This bot runs off of Node.js. You can download it from https://nodejs.org/en/download/

Once node is installed, run `npm install` from the bot directory to install the bot's dependencies. If the dependencies all install successfully (note: you may have to run `npm -g install windows-build-tools` first) then you can now run the bot by running `node bot`.

# Running
Initially the bot will generate an empty `auth.json` file and likely throw an error. You need to put the bot's token and your userID in this auth.json file for the bot to work properly. Format should look like this:
```json
{
	"discord": "MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs",
	"owner": "99326032288423936"
}
```

(don't worry, that token is the one Discord publishes on its API docs)

## Invite Links

By default, the bot will not allow use of the `invite` command.  To enable it, fill in the inviteCode parameter in the auth.json file (add it as it won't show up on its own) with your bot's Client ID (**NOT** the Client Secret!)

```json
For example: {
	"discord": "MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs",
	"owner": "99326032288423936",
	"inviteCode" : "12345678901234"
}
```
