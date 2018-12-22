module.exports = bot => {
  bot.on("shardReady", id => console.log(`Shard ${id} ready!`));
};