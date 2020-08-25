# Tupperbox
A Discord bot written in [eris](https://github.com/abalabahaha/eris) for proxying user messages through webhooks to emulate users having multiple Discord accounts.

* [Click here to invite the bot to your server!](https://discord.com/oauth2/authorize?client_id=431544605209788416&scope=bot&permissions=536996928)

* [Click here to join our support server!](https://discord.com/invite/rHxMbt2)

# Local Installation
Tupperbox requires Node.js, PostgreSQL and Redis. You can download Node.js [here](https://nodejs.org/en/download/), PostgreSQL [here](https://www.postgresql.org/download/) and Redis [here (Linux)](https://redis.io/download) or [here (Windows)](https://www.memurai.com/).

Once Node.js is installed, run `npm install` from the bot directory to install the bot's dependencies. (Note: you may have to run `npm -g install windows-build-tools` first if on Windows)

The bot expects a file in the same directory named `.env` with its configuration info. An example configuration can be found in the `.env.example` file.

* The PG-prefixed variables should be filled in with the connection info to your PostgreSQL database set up during installation. <br> You need a **database**, a **user** with associated **password** with full write access to that database, and the **host IP** of the machine running the server (localhost if it's the same machine).

* SENTRY_DSN is a link to a registered Sentry project. See https://sentry.io/ for more information on Sentry. <br> This is **optional**.

* Edit `DEFAULT_PREFIX`, `DEFAULT_LANG` as desired.

* `BOT_INVITE` is the bot's user ID, used in the `tul!invite` command. `SUPPORT_INVITE` is the invite ID (**not invite link**) to the bot's support server, used in the `tul!feedback` command. <br> Remove either of these to remove the respective bot commands.

* Leave `REDISURL` alone unless you change the port Redis runs on or you host it on another machine.


Tupperbox requires PostgreSQL and Redis. You can download PostgreSQL [here](https://www.postgresql.org/download/) and Redis [here (Linux)](https://redis.io/download) or [here (Windows)](https://www.memurai.com/).

# Upgrading from JSON storage

The previous version of the bot used JSON as a database. <br> If you would like to upgrade, install PostgreSQL and Redis, switch to the rewrite branch, and on startup the bot will prompt you to import your JSON databases to the Postgres server you've configured automatically. (Make a backup of these files first - it will delete them!)