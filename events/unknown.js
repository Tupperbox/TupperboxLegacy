module.exports = bot => {
  bot.on("unknown", (packet,id) => console.log(`Shard ${id} unknown packet:`,packet));
};