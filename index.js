const DataBase = require('easy-json-database');

const { Client, Intents, MessageButton, MessageActionRow} = require('discord.js');
const bot = new Client({ intents: "32767"});

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {ApplicationCommandOptionType} = require("discord-api-types/v10");


const config = require('./config.json');
const constants = require("constants");

const ticket_db = new DataBase('./ticket.json', {});
const onerole_db = new DataBase('./onerole.json', {});
const sanction_db = new DataBase('./sanction.json', {});

function addSanction(member, reason, modo, link) {
    if (link === undefined) {
        const sanction = {
            reason: reason,
            timestamp: Date.now(),
            modo: modo,
            link: null
        }
    } else {
        const sanction = {
            reason: reason,
            timestamp: Date.now(),
            modo: modo,
            link: link,
        }
    }
    if (!sanction_db.has(member.id)) {
        sanction_db.set(member.id,[sanction]);
    } else {
        sanction_db.push(member.id, sanction);
    }
}

const commands = [
    {
        name: 'ping',
        description: 'Renvoie la latence du bot.',
    },
    {
        name: 'help',
        description: 'Affiche la liste des commandes.',
    },
    {
        name: 'tempmute',
        description: 'Mute un utilisateur pendant un certain temps.',
        options: [
            {
                name: 'pseudo',
                description: 'Le pseudo de l\'utilisateur à mute.',
                required: true,
                type: ApplicationCommandOptionType.User,
            },
            {
                name: 'temps',
                description: 'Temps en (S)econdes / (M)inutes / (H)eures / (J)ours / (W)Semaines.',
                required: true,
                type: ApplicationCommandOptionType.String,
            },
            {
                name: 'raison',
                description: 'Raison du mute.',
                required: true,
                type: ApplicationCommandOptionType.String,
            },
        ],
    },
    {
        name: 'ticket',
        description: 'Créer un ticket.',
    },
    {
        name: '1role',
        description: 'Ajoute le rôle sélectionné à un utilisateur.',
        options: [
            {
                name: 'pseudo',
                description: 'Le pseudo de l\'utilisateur.',
                required: true,
                type: ApplicationCommandOptionType.User,
            },
            {
                name: 'role',
                description: 'Le rôle à ajouter.',
                required: true,
                type: ApplicationCommandOptionType.String,
                choices:
                    config.ONEROLE.map(role => {
                        return {
                            name: role,
                            value: role,
                        };
                    }),
            },
        ],
    },
    {
        name: 'github',
        description: 'Ouvre le GitHub du bot.',
    }
];

const rest = new REST().setToken(config.BOT_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands("967754517967941652", config.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Connection des nouveaux membres
const regex = new RegExp(/[A-zÀ-ú]+[-|\s]?[A-zÀ-ú]*/gm)
const filter = m => m.author.id !== bot.user.id;

let nom,prenom;

function fcollector(channel,member) {
    let toReturn;
    const collector = channel.createMessageCollector({filter, max:1, time: 31536000});
    collector.on('collect', m => {
        toReturn = m.content;
    });
    collector.on('end', collected => {
        console.log(toReturn);
        if (toReturn.match(regex)[0].length !== toReturn.length) {
            console.log("No match");
            channel.send(`Le prénom est incorrect, veuillez réessayer.\nSi vous pensez qu'il s'agit d'une erreur, contactez Siryak#5777.\nRessayez`);
            fcollector(channel, member);
        } else if (toReturn.length > 15 || toReturn.length < 3) {
            channel.send(`Le prénom est trop long *ou trop court*. Il doit faire entre 3 et 15 caractères inclus.\nSi vous pensez qu'il s'agit d'une erreur, contactez Siryak#5777.\nRessayez`);
            fcollector(channel, member);
        } else {
            prenom = toReturn.substring(0,1).toUpperCase() + toReturn.substring(1).toLowerCase();
            channel.send(`Veuillez entrer votre nom.`);
            fcollector2(channel,member);
        }
    });
}

function fcollector2(channel, member) {
    let toReturn;
    const collector = channel.createMessageCollector({filter, max:1, time: 31536000});
    collector.on('collect', m => {
        toReturn = m.content;
    });
    collector.on('end', collected => {
        console.log(toReturn);
        if (toReturn.match(regex)[0].length !== toReturn.length) {
            console.log("No match");
            channel.send(`Le nom est incorrect, veuillez réessayer.\nSi vous pensez qu'il s'agit d'une erreur, contactez Siryak#5777.\nRessayez`);
            fcollector2(channel, member);
        } else if (toReturn.length > 15 || toReturn.length < 3) {
            channel.send(`Le nom est trop long *ou trop court*. Il doit faire entre 3 et 15 caractères inclus.\nSi vous pensez qu'il s'agit d'une erreur, contactez Siryak#5777.\nRessayez`);
            fcollector2(channel, member);
        } else {
            nom = toReturn.substring(0,1).toUpperCase() + toReturn.substring(1).toLowerCase();
            //validation du nom et prénom par des boutons
            const validationNom = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId('validate')
                    .setLabel('Oui')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('cancel')
                    .setLabel('Non')
                    .setStyle('DANGER'),
            );

            channel.send({content: `Validez-vous le Prénom et le Nom :  ${prenom} ${nom} ?`, components: [validationNom]});
        }
    });
}

bot.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === `validate`) {
        interaction.member.roles.add(interaction.guild.roles.cache.find(role => role.id === config.MAIN_ROLE));
        interaction.member.setNickname(`${prenom} ${nom}`);
        interaction.channel.delete();
    }

    if (interaction.customId === `cancel`) {
        interaction.reply(`Quel est ton Prénom ?`);
        fcollector(interaction.channel,interaction.member);
    }
});

// Connection des nouveaux membres

bot.on('guildMemberAdd',  member => {
    const channel_ = member.guild.channels.create(`${member.displayName}`, {
        type: 'GUILD_TEXT',
        parent: config.LOGIN_CAT,
        permissionOverwrites: [
            {
                id: member.guild.roles.everyone,
                deny: ['VIEW_CHANNEL'],
            },
        ],
    }).then(channel => {
        channel.permissionOverwrites.create(member, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            EMBED_LINKS: true,
            ATTACH_FILES: true,
            READ_MESSAGE_HISTORY: true,
        });
        channel.permissionOverwrites.create(member.guild.roles.cache.find(role => role.id === config.ROLE_MOD), {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            EMBED_LINKS: true,
            ATTACH_FILES: true,
            READ_MESSAGE_HISTORY: true,
        });
        channel.send(`Bienvenue <@${member.id}> sur le serveur de la Promo67 !`);
        channel.send(`Attention à bien remplir ce formulaire, les informations données ne pourront être modifié que par un modérateur.`);
        //demander le nom / prénom
        channel.send(`Quel est ton Prénom ?`);
        fcollector(channel,member);
    });
});

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({ content : `🏓 La latence est de ${Date.now() - interaction.createdTimestamp}ms. La latence de l'API est de ${Math.round(bot.ws.ping)}ms`, ephemeral: true });
    }

    if (interaction.commandName === 'help') {
        await interaction.reply({ content : `Voici la liste des commandes : \n\n${commands.map(command => `**${command.name}** : ${command.description}`).join('\n')}`, ephemeral: true});
    }

    if (interaction.commandName === 'tempmute') {
        const pseudo = interaction.options.get('pseudo');
        const temps = interaction.options.get('temps');
        const raison = interaction.options.get('raison');
        const user = interaction.guild.members.cache.find(user => user.id === pseudo.value);

        let duree = parseInt(temps.value);
        let unite = temps.value.toString().slice(-1).toLowerCase();

        if (unite !== 's' && unite !== 'm' && unite !== 'h' && unite !== 'j' && unite !== 'w') {
            await interaction.reply('Veuillez entrer un temps valide.');
        }else {
            if (unite === 's') {
                duree *= 1000;
                unite = 'secondes';
            }
            if (unite === 'm') {
                duree *= 1000 * 60;
                unite = 'minutes';
            }
            if (unite === 'h') {
                duree *= 1000 * 60 * 60;
                unite = 'heures';
            }
            if (unite === 'j') {
                duree *= 1000 * 60 * 60 * 24;
                unite = 'jours';
            }
            if (unite === 'w') {
                duree *= 1000 * 60 * 60 * 24 * 7;
                unite = 'semaines';
            }
            await user.timeout(duree, raison);
            await interaction.reply(`${user.user.username} a été mute pendant ${parseInt(temps.value)} ${unite}.`);
            addSanction(user.id, raison, interaction.author.id);
        }
    }

    if (interaction.commandName === 'ticket') {
        const user = interaction.member;
        //créer un channel dans la catégorie 899726058943815731
        if (!ticket_db.has(user.user.id)){
            const channel = await interaction.guild.channels.create(`ticket-${user.user.username}`, {
                type: 'GUILD_TEXT',
                parent: config.TICKET_CAT,
            });
            ticket_db.set(channel.id, user.user.id);
            ticket_db.set(user.user.id, true);
            interaction.reply({content: `Votre ticket a bien été créé.`, ephemeral: true});
            //donner la permission de lecture et d'écruture de user
            await channel.permissionOverwrites.create(interaction.user, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                EMBED_LINKS: true,
                ATTACH_FILES: true,
                READ_MESSAGE_HISTORY: true,
                MANAGE_CHANNELS: true,
            });
            //donner la permission de lecture et d'écruture aux modérateurs
            await channel.permissionOverwrites.create(interaction.guild.roles.cache.find(role => role.id === config.ROLE_MOD), {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                EMBED_LINKS: true,
                ATTACH_FILES: true,
                READ_MESSAGE_HISTORY: true,
                MANAGE_CHANNELS: true,
            });
            //creer un bouton dans le channel pour le supprimer
            const row = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId('end_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle('DANGER')
            );
            channel.send({content: `Bienvenue <@${interaction.user.id}> dans votre ticket.` ,components: [row]});
        }else{
            interaction.reply({content: 'Vous avez déjà un ticket ouvert.', ephemeral: true});
        }
    }
    if (interaction.commandName === '1role') {
        const pseudo = interaction.options.get('pseudo');
        const role = interaction.options.get('role');
        const user = interaction.guild.members.cache.find(user => user.id === pseudo.value);
        const role_to_add = interaction.guild.roles.cache.find(AddRole => AddRole.name === role.value);
        let target;
        // supprimer le role à tout ceux qui ont le role
        if (onerole_db.has(role.value)) {
            target = interaction.guild.members.cache.find(user => user.id === onerole_db.get(role.value));
            await target.roles.remove(role_to_add);
            onerole_db.set(role.value, user.user.id);
            await user.roles.add(role_to_add);
        } else {
            onerole_db.set(role.value, user.user.id);
            await user.roles.add(role_to_add);
        }
    }
    if (interaction.commandName === 'github') {
        //bouton pour ouvrir le lien github
        const GithubLink = new MessageActionRow().addComponents(
            new MessageButton()
                .setLabel(':heart: Github')
                .setStyle('LINK')
                .setUrl('https://github.com/Cyriaque-TONNERRE/Chanael/')
        );
        interaction.reply({content: `Ci-dessous le github du bot, n'hésitait si vous trouvez des erreurs et/ou si vous voulez proposez des fonctionnalités **utile**`,component: [GithubLink], ephemeral: true});
    }
});

bot.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === `end_ticket`){
        if(interaction.member.roles.cache.some((role) => role.id === config.ROLE_MOD) || interaction.member.permissions.has("ADMINISTRATOR")){
            interaction.channel.delete();
            ticket_db.delete(ticket_db.get(interaction.channel.id));
            ticket_db.delete(interaction.channel.id);
        } else {
            interaction.reply({content: 'Vous n\'avez pas la permission de faire cela.', ephemeral: true});
        }
    }
});

bot.on('channelDelete', channel => {
    if (ticket_db.has(channel.id)) {
        ticket_db.delete(ticket_db.get(channel.id));
        ticket_db.delete(channel.id);
    }
})

bot.on('ready', () => {
    console.log('Bot is ready !');
    console.log(`Logged in as ${bot.user.tag}`);
    console.log(`ID: ${bot.user.id}`);
});

bot.login(config.BOT_TOKEN);