const util = require("util");

module.exports = {
    permitted: (msg, bot) => msg.author.id == bot.owner,
    execute: async (bot, msg, args, cfg) => {
        if (msg.author.id != bot.owner) return;
        switch(args.shift()) {
            case "eval":
                let out;
                try {
                    out = await eval(msg.content.slice(cfg.prefix.length + 9).trim());
                } catch(e) { out = e.toString(); }
                return util.inspect(out.split(process.env.DISCORD_TOKEN).join("[[ TOKEN ]]")).slice(0,2000);
            case "reload":
                process.send({name: "broadcast", msg: {name: "reload", type: args[0], targets: args.slice(1), channel: msg.channel.id}});
                if(args[0] == "queue") process.send({name:"reloadQueue"});
                if(args[0] == "ipc") process.send({name:"reloadIPC"});
                break;
            case "blacklist":
                await bot.banAbusiveUser(args.shift(), msg.channel.id);
                break;
            }
    }
}
