# Tupperbox
A Discord bot written in <a href="https://github.com/abalabahaha/eris">eris</a> for proxying user messages through webhooks, originally created to emulate tulpas/systems users having their own user accounts.

# Commands
- tul!avatar  -  View or change a member's avatar
- tul!birthday  -  View or change a member's birthday, or see upcoming birthdays
- tul!brackets  -  View or change a member's brackets
- tul!cfg  -  Configure server-specific settings
  - tul!cfg prefix \<newPrefix> - Change the bot's prefix
  - tul!cfg rename \<newname> - Change all instances of the default name 'member' in bot replies in this server to the specified term
  - tul!cfg log \<channel> - Enable the bot to send a log of all member messages and some basic info like who registered them. Useful for having a searchable channel and for distinguishing between similar names.
  - tul!cfg blacklist <add|remove> <channel(s)> - Add or remove channels to the bot's proxy blacklist - users will be unable to proxy in blacklisted channels.
  - tul!cfg cmdblacklist <add|remove> <channel(s)> - Add or remove channels to the bot's command blacklist - users will be unable to issue commands in blacklisted channels.
- tul!describe  -  View or change a member's description
- tul!feedback  -  Get a link to the support server
- tul!find  -  Find and display info about members by name
- tul!help  -  Print this message, or get help for a specific command
- tul!invite  -  Get the bot's invite URL
- tul!list  -  Get a detailed list of yours or another user's registered members
- tul!register  -  Register a new member
- tul!remove  -  Unregister a member
- tul!rename  -  Change a member's name
- tul!showuser  -  Show the user that registered the member that last spoke
- tul!tag  -  Remove or change a member's or your user tag (displayed next to name when proxying)
- tul!togglebrackets - Toggle whether the brackets used to proxy also show up in the resulting message for the given member.

# Installation
This bot runs off of Node.js. You can download it from https://nodejs.org/en/download/

Once node is installed, run `npm install` from the bot directory to install the bot's dependencies. If the dependencies all install successfully (note: you may have to run `npm -g install windows-build-tools` first if on Windows) then you can now run the bot by running `node bot`.

Additionally, the bot now requires PostgreSQL to run. You can download it from https://www.postgresql.org/download/

# Running
The bot expects a file in the same directory named `.env` with some data to get it started. Format should look like this:
```
DISCORD_TOKEN=MTk4NjIyNDgzNDcxOTI1MjQ4.Cl2FMQ.ZnCjm1XVW7vRze4b7Cq4se7kKWs
DISCORD_OWNERID=99326032288423936
DISCORD_INVITE=431544605209788416 (note: remove this line if you don't want the bot to have an invite command)
PGUSER=???
PGHOST=???
PGDATABASE=???
PGPASSWORD=???
PGPORT=3456
SENTRY_DSN=https://(key)@sentry.io/(id)
```
(don't worry, that token is a fake)
The PG-prefixed variables should be filled in with the connection info to your PostgreSQL database set up during installation. You need a **database**, a **user** with associated **password** with full write access to that database, and the **host IP** of the machine running the server (localhost if it's the same machine).
SENTRY_DSN is a link to a registered Sentry project. Make one here: https://sentry.io/ and copy the provided DSN link into that field.

# Upgrading from JSON storage
The new version of the bot runs on PostgreSQL and not JSON. If you would like to upgrade, install PostgreSQL, switch to the rewrite branch, and on startup the bot will prompt you to import your JSON databases to the Postgres server you've configured automatically. (Make a backup of these files first - it will delete them)
