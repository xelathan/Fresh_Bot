const Discord = require('discord.js');
const client = new Discord.Client();

client.commands = new Discord.Collection();
client.events = new Discord.Collection();

['command_handler', 'event_handler'].forEach(handler => {
    require(`./handlers/${handler}`)(client, Discord);
})

client.login('ODQ5MDE5MDcxMTEzODU0OTg3.YLVEoA.XymJJnTJbRUctXwbcUIoAIL0MRk');