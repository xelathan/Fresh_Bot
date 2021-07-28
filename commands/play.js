const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const message = require('../events/guild/message');

const queue = new Map();

module.exports = {
    name: 'play',
    description:'Advanced music bot',
    aliases: ['play', 'skip', 'stop', 'queue', 'help'],
    async execute(message, args, cmd, client, Discord) {
        const voiceChannel = message.member.voice.channel;

        if(!voiceChannel) return message.channel.send('You need to be in a voice channel to run this command.');
        if(message.channel.type == 'dm') return message.channel.send('Commands for this bot cannot be executed in DMs.');

        const permissions = voiceChannel.permissionsFor(message.client.user);
        if(!permissions.has('CONNECT')) return message.channel.send('You do not have the correct permissions.');
        if(!permissions.has('SPEAK')) return message.channel.send('You do not have the correct permissions.');

        const serverQueue = queue.get(message.guild.id);

        if(cmd === 'play') {
            if(args.length < 1) return message.channel.send('You do not have the correct amount of arguements.');
            let song = {};

            if(ytdl.validateURL(args[0])) {
                const songInfo = await ytdl.getInfo(args[0]);
                song = {title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, lengthSeconds: songInfo.videoDetails.lengthSeconds};
            } else {
                const videoFinder = async (query) => {
                    const videoResult = await ytSearch(query);
                    return (videoResult.videos.length > 1) ? videoResult.videos[0] : null;
                }

                const video = await videoFinder(args.join(' '));

                if(video) {
                    song = {title: video.title, url: video.url, lengthSeconds: video.seconds};
                } else {
                    message.channel.send('No video results found.');
                }
            }

            if(!serverQueue) {
                const queueConstructor = {
                    voice_channel: voiceChannel,
                    text_channel: message.channel,
                    connection: null,
                    songs: []
                }
    
                queue.set(message.guild.id, queueConstructor);
                queueConstructor.songs.push(song)

                try {
                    const connection = await voiceChannel.join();
                    queueConstructor.connection = connection;
                    video_player(message.guild, queueConstructor.songs[0], Discord);
                } catch(err) {
                    queue.delete(message.guild.id);
                    message.channel.send('The bot was not able to connect to the voice channel.');
                    throw err;
                }
            } else {
                serverQueue.songs.push(song);
                const embed = new Discord.MessageEmbed()
                .setColor('#CD5C5C')
                .setTitle(`***${song.title}***`)
                .setURL(`${song.url}`)
                .setFooter(`Added to the queue!`)
                return message.channel.send(embed);
            }
        }
        else if(cmd === 'skip') skip_song(message, serverQueue);
        else if(cmd === 'stop') stop_song(message, serverQueue);
        else if(cmd == 'help') command_list(this.aliases, message);
        else if(cmd == 'queue') {
            if(!serverQueue) {
                return message.channel.send('The queue is empty.');
            }
            get_queue(message, serverQueue, Discord);
        }

    }
}

const video_player = async (guild, song, Discord) => {
    const song_queue = queue.get(guild.id);

    if(!song) {
        song_queue.voice_channel.leave();
        queue.delete(guild.id);
        return;
    }

    const stream = ytdl(song.url, {filter: 'audioonly'})
    song_queue.connection.play(stream, {seek: 0, volume: 1}).on('finish', () => {
        song_queue.songs.shift();
        video_player(guild, song_queue.songs[0], Discord);
    })

    await song_queue.text_channel.send(`Now Playing: ***${song.title}***`);
}

const skip_song = (message, serverQueue) => {
    if(!message.member.voice.channel) return message.channel.send('You need to be in a voice channel to run this command.');
    if(!serverQueue) return message.channel.send('There are no songs in the queue.');
    if(serverQueue.songs.length == 1) {
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end();
    } else {
        serverQueue.connection.dispatcher.end();
    }
}

const stop_song = (message, serverQueue) => {
    if(!message.member.voice.channel) return message.channel.send('You need to be in a voice channel to run this command.');
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

const command_list = (list, message) => {
    let mystring = 'List of commands:\n';
    list.forEach(i => {
        mystring += '-' + i + '\n';
    });
    message.reply('\n' + mystring);
}

const get_queue = (message, serverQueue, Discord) => {
    let mystring = ''
    const embed = new Discord.MessageEmbed()
    .setColor('#CD5C5C')
    .setTitle('Queue')

    for (let i = 0; i < serverQueue.songs.length; i++) {
        const timeFormat = time_format(serverQueue.songs[i].lengthSeconds)
        if(i == 0) {
            embed.addFields({name: '***Now Playing***:', value: `${serverQueue.songs[i].title}\n${serverQueue.songs[i].url}\nDuration: ${timeFormat}\n`});
        } else {
            mystring += `${i}. ${serverQueue.songs[i].title}\n${serverQueue.songs[i].url}\nDuration: ${timeFormat}\n\n`;
        }
    }
    if(serverQueue.songs.length > 1) {
        embed.addFields({name: '***Up Next:***:', value: `${mystring}`});
    }
    message.channel.send(embed);
}

const time_format = (total_seconds) => {
    const minutes = Math.floor(total_seconds/60);
    const seconds = total_seconds - (minutes * 60);
    const final = `${minutes}:${seconds-1}`;
    return final
}