module.exports = bot => {
  bot.on("shardDisconnect", (err,id) => console.error(`Shard ${id} disconnected!`,err));
};