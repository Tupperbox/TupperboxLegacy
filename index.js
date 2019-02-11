require("dotenv").config();
const Sharder = require('eris-sharder').Master;
const cluster = require('cluster');

const init = async () => {
    if(cluster.isMaster) {
        try { 
            require("./auth.json");
            throw new Error("outdated");
        } catch(e) { 
            if(e.message == "outdated") throw new Error("auth.json is outdated, please use the .env file instead! See the github page for more info");
        }

        await require("./modules/db").init();
    }

    let sharder = new Sharder(process.env.DISCORD_TOKEN,'/bot.js',{
        clientOptions: {
            disableEvents: {
                GUILD_BAN_ADD: true,
                GUILD_BAN_REMOVE: true,
                MESSAGE_DELETE: true,
                MESSAGE_DELETE_BULK: true,
                MESSAGE_UPDATE: true,
                TYPING_START: true,
                VOICE_STATE_UPDATE: true
            },
            messageLimit: 0
        },
        stats: true,
        //clusters: 2,
        //shards: 2,
        debug: true,
        name: 'Tupperbox'
    });

    sharder.on('stats', stats => {
        console.log(stats);
    });    
}

init();