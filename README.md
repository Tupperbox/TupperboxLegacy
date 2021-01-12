# This is the open-source fork of the public [Tupperbox bot](https://discord.com/oauth2/authorize?client_id=431544605209788416&scope=bot&permissions=536996928).
This fork is not currently being worked on. Pull requests or issues opened on this fork may not be looked at for a while. In the future more features are planned to be brought to this fork for those of you hosting your own versions of Tupperbox.
If you have an issue with the [live version of Tupperbox](https://discord.com/oauth2/authorize?client_id=431544605209788416&scope=bot&permissions=536996928) then please join the [support server](https://discord.com/invite/rHxMbt2) for help.

# Tupperbox
A Discord bot written in [eris](https://github.com/abalabahaha/eris) for proxying user messages through webhooks to emulate users having multiple Discord accounts.

* [Click here to invite the public bot to your server!](https://discord.com/oauth2/authorize?client_id=431544605209788416&scope=bot&permissions=536996928)

* [Click here to join our support server!](https://discord.com/invite/rHxMbt2)

# Local Installation
The self-hosted version of Tupperbox requires Node.js (must be at least v14), PostgreSQL (v11, preferably v12) and Redis (stable, currently v6.0.8). You can download Node.js [here](https://nodejs.org/en/download/), PostgreSQL [here](https://www.postgresql.org/download/) and Redis [here (Linux)](https://redis.io/download) or [here (Windows)](https://www.memurai.com/).

Once Node.js is installed, run `npm install` from the bot directory to install the bot's dependencies. (Note: you may have to run `npm -g install windows-build-tools` first if on Windows)

The bot expects a file in the same directory named `.env` with its configuration info. An example configuration can be found in the `.env.example` file.

* The PG-prefixed variables should be filled in with the connection info to your PostgreSQL database set up during installation. <br> You need a **database**, a **user** with associated **password** with full write access to that database, and the **host IP** of the machine running the server (localhost if it's the same machine).

* SENTRY_DSN is a link to a registered Sentry project. See https://sentry.io/ for more information on Sentry. <br> This is **optional**.

* Edit `DEFAULT_PREFIX`, `DEFAULT_LANG` as desired.

* `BOT_INVITE` is the bot's user ID, used in the `tul!invite` command. `SUPPORT_INVITE` is the invite ID (**not invite link**) to the bot's support server, used in the `tul!feedback` command. <br> Remove either of these to remove the respective bot commands.

* Leave `REDISURL` alone unless you change the port Redis runs on or you host it on another machine.
