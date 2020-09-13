const cluster = require("cluster");
const os = require("os");

const dhm = t => {
	let cd = 24 * 60 * 60 * 1000, ch = 60 * 60 * 1000, cm = 60 * 1000, cs = 1000;
	let d = Math.floor(t/cd), h = Math.floor((t-d*cd)/ch), m = Math.floor((t-d*cd-h*ch)/cm), s = Math.floor((t-d*cd-h*ch-m*cm)/cs);
	return `${d}d ${h}h ${m}m ${s}s`;
};

let masterExports = (enqueue) => {
  this.postStats = (wrk,msg,shrd) => {
    if(!msg.channelID) return;
    let guilds = shrd.stats.stats.clusters.reduce((a,b)=>a+b.guilds,0);
    shrd.eris.createMessage(msg.channelID,
      "```"+shrd.stats.stats.clusters.sort((a,b) => a.cluster-b.cluster).map(c => 
        `Cluster ${c.cluster}${c.cluster < 10 ? " " : ""} - ${c.shards} shards -- ${c.ram.toFixed(1)} MB RAM -- ${c.guilds} servers (up ${dhm(c.uptime)})`).join("\n")
      +`\n\nTotal memory used: ${(shrd.stats.stats.totalRam/1000000).toFixed(1)} MB/${(os.totalmem()/1000000).toFixed(1)} MB\nTotal servers: ${guilds}\n\nRequest received on Shard ${msg.shard} (Cluster ${msg.cluster})` + "```"
    );
  },
  
  this.queueDelete = (wrk, msg, shrd) => {
    if(!msg.channelID || !msg.messageID) return;
    enqueue(msg);
  },
  
  this.reloadQueue = () => {
    delete require.cache[require.resolve('./queue')];
    enqueue = require("./queue");
  },
  
  this.restartCluster = (wrk,msg,shrd) => {
    if(msg.id == null) return;
    cluster.workers[shrd.clusters.get(msg.id).workerID].kill();
  }

  return this;
};

const types = ['command', 'module', 'event'];
const modules = ['blacklist', 'cmd', 'db', 'msg', 'paginator', 'proxy', 'redis'];

let botExports = (bot) => {

  this.reload = async msg => {
 
    if(!msg.type || !msg.targets || !msg.channel) return;
 
    let out = "";
    msg.targets.forEach(async (arg) => {
      try {
        let path = `../${msg.type}s/${arg}`;

        if (types.includes(msg.type)) delete require.cache[require.resolve(path)];
        if (msg.type == "command") bot.cmds[arg] = require(path);

        else if(msg.type == "event") {
          bot.removeAllListeners(arg);
          let func = require(path);
          bot.on(arg, (...a) => func(...a,bot));
        }

        else if(msg.type == "module") {
          if (arg == "db") await bot.db.end();
          if (modules.includes(arg)) bot[arg] = require(`../modules/${arg + (arg == "blacklist" ? ".json" : '')}`)
          else switch(arg) {

            case "util":
              require("../modules/util")(bot);
              break;

            case "ipc":
              process.send({name:"reloadIPC"});
              require("../modules/ipc")(bot);
              break;
        }}

        out += `${arg} reloaded\n`;
      } catch(e) {
        out += `Could not reload ${arg} (${e.code}) - ${e.stack}\n`;
      }
    });

    console.log(out);
  },

  this.eval = async msg => {
    if(!msg.code) return;
    let result = await eval(msg.code);
    console.log(result);
  }

  bot.ipc = this;
};

if (cluster.isMaster) module.exports = masterExports(require("./queue"));
else module.exports = botExports;