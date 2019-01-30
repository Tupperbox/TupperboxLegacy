const Eris = require("eris");
const {promisify} = require("util");
const fs = require("fs");
const auth = require("./auth.json");

const init = async () => {

  const bot = new Eris(auth.discord, {
    maxShards: "auto",
    disableEvents: {
      GUILD_BAN_ADD: true,
      GUILD_BAN_REMOVE: true,
      MESSAGE_DELETE: true,
      MESSAGE_DELETE_BULK: true,
      MESSAGE_UPDATE: true,
      TYPING_START: true,
      VOICE_STATE_UPDATE: true
    },
    messageLimit: 0,
  });

  //create data files if they don't exist
  ["/tulpae.json","/servercfg.json","/webhooks.json"].forEach(async file => {
    if(!(await promisify(fs.exists)(__dirname + file)))
      await promisify(fs.writeFile)(__dirname + file, "{ }");
  });

  bot.tulpae = require("./tulpae.json");
  bot.config = require("./servercfg.json");
  bot.webhooks = require("./webhooks.json");

  bot.recent = {};
  bot.pages = {};

  bot.cmds = {};
  
  require("./modules/util")(bot);
  bot.backupAll();
  setInterval(() => bot.saveAll(), 600000);
  
  setInterval(() => bot.backupAll(), 86400000);
  
  bot.logger = require("./modules/logger");
  
  console.log("COMMANDS:");
  files = await promisify(fs.readdir)("./commands");
  files.forEach(file => {
    console.log(`\t${file}`);
    bot.cmds[file.slice(0,-3)] = require("./commands/"+file);
  });
  
  console.log("\nEVENTS:");
  files = await promisify(fs.readdir)("./events");
  files.forEach(file => {
    console.log(`\t${file}`);
    bot.on(file.slice(0,-3), (...args) => require("./events/"+file)(...args,bot));
  });

  if (!auth.inviteCode) {
    delete bot.cmds.invite;
  }

  bot.connect();
};

init();