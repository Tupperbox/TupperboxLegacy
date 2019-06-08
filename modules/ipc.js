const cluster = require('cluster');

if(cluster.isMaster) {
    module.exports = {
        postStats: (wrk,msg,shrd) => {
            if(!msg.channelID) return;
            shrd.eris.createMessage(msg.channelID,"testgay");
        }
    }
} else {
    module.exports = bot => {
        bot.ipc = {
            reload: async msg => {
                if(!msg.type || !msg.targets || !msg.channel) return;
                let out = "";
                for(let arg of msg.targets) {
                    try {
                        let path = `../${msg.type}s/${arg}`;
                        let fullPath = require.resolve(path);
                        if(msg.type == "command") {
                            delete require.cache[fullPath];
                            bot.cmds[arg] = require(path);
                        } else if(msg.type == "module") {
                            delete require.cache[fullPath];
                            switch(arg) {
                                case "util":
                                    require("../modules/util")(bot);
                                    break;
                                case "logger":
                                    bot.logger = require("../modules/logger");
                                    break;
                                case "db":
                                    await bot.db.end();
                                    bot.db = require("../modules/db");
                                    break;
                                case "errors":
                                    break;
                                case "ipc":
                                    process.send({name:"reloadIPC"});
                                    require("../modules/ipc")(bot);
                                    break;
                            }
                        } else if(msg.type == "event") {
                            bot.removeAllListeners(arg);
                            delete require.cache[fullPath];
                            let func = require(path);
                            bot.on(arg, (...a) => func(...a,bot));
                        }
                        out += `${arg} reloaded\n`;
                    } catch(e) {
                        out += `Could not reload ${arg} (${e.code}) - ${e.stack}\n`;
                    }
                }
                bot.createMessage(msg.channel, `Cluster ${bot.base.clusterID} reload:\n${out}`);
            }
        }
    }
}