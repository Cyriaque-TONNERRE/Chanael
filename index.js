const maths = require('mathjs');
const cron = require('node-cron');
const { QuickDB } = require("quick.db");

const { Client, MessageButton, MessageActionRow, MessageEmbed} = require('discord.js');
const bot = new Client({ intents: "32767"});

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {ApplicationCommandOptionType} = require("discord-api-types/v10");

const config = require('./config.json');
const {randomInt, forEach} = require("mathjs");

const db = new QuickDB();

const ticket_db = db.table("ticket");
const admin_ticket_db = db.table("admin_ticket");
const onerole_db = db.table("onerole");
const sanction_db = db.table("sanction");
const nb_sanction_db = db.table("nb_sanction");
const xp_db = db.table("xp");
const money_db = db.table("money");
const bday_db = db.table("bday");

function addSanction(member, reason, modo, channel, link) {
    let sanction;
    if (link === undefined) {
        sanction = {
            reason: reason,
            timestamp: Date.now(),
            modo: modo.id,
            link: undefined
        }
    } else {
        sanction = {
            reason: reason,
            timestamp: Date.now(),
            modo: modo.id,
            link: link,
        }
    }
    if (!sanction_db.has(member.id)) {
        sanction_db.set(member.id,[sanction]);
    } else {
        sanction_db.push(member.id, sanction);
    }
    if (!nb_sanction_db.has(member.id)) {
        nb_sanction_db.set(member.id, 1);
    } else {
        nb_sanction_db.get(member.id).then(nb_sanction => {
            nb_sanction_db.set(member.id, nb_sanction + 1);
        });

    }
    automute(member, channel);
}

async function verificationpermission(interaction) {
    if (interaction.member.roles.cache.has(config.ROLE_MOD) || interaction.member.roles.cache.has(config.ROLE_ADMIN)) {
        return true;
    } else {
        interaction.reply({content :"Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true});
        return false;
    }
}

function automute(user, channel) {
    const member = channel.guild.members.cache.get(user.id);
    nb_sanction_db.get(member.id).then( nb_sanction => {
        if ((nb_sanction + 1) >= 10) {
            member.timeout(604800000, "Auto-Sanction");
            channel.send(`${member.displayName} a été réduit au silence 7 jours pour avoir commis ${nb_sanction + 1} infractions au règlement.`);
        } else if ((nb_sanction + 1) === 7) {
            member.timeout(259200000, "Auto-Sanction");
            channel.send(`${member.displayName} a été réduit au silence 3 jours pour avoir commis 7 infractions au règlement.`);
        } else if ((nb_sanction + 1) === 5) {
            member.timeout(86400000, "Auto-Sanction");
            channel.send(`${member.displayName} a été réduit au silence 1 jours pour avoir commis 5 infractions au règlement.`);
        } else if ((nb_sanction + 1) === 3) {
            member.timeout(21600000, "Auto-Sanction");
            channel.send(`${member.displayName} a été réduit au silence 1 heure pour avoir commis 3 infractions au règlement.`);
        } else {
            channel.send(`${member.displayName} a commis ${nb_sanction + 1} infractions au règlement.`);
        }
    });
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
                name: 'durée',
                description: 'Durée du mute.',
                required: true,
                type: ApplicationCommandOptionType.Integer,
            },
            {
                name: 'unité',
                description: 'Unité de temps. (Max 28 jours / 4 semaines)',
                required: true,
                type: ApplicationCommandOptionType.String,
                choices:[
                    {
                        name: 'Minutes',
                        value: 'Minutes',
                    },
                    {
                        name: 'Heures',
                        value: 'Heures',
                    },
                    {
                        name: 'Jours',
                        value: 'Jours',
                    },
                    {
                        name: 'Semaines',
                        value: 'Semaines',
                    }
                ]
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
        name: 'adminticket',
        description: `Force l'ouverture d'un ticket avec un utilisateur.`,
        options: [
            {
                name: 'pseudo',
                description: 'Le pseudo de l\'utilisateur à ouvrir le ticket.',
                required: true,
                type: ApplicationCommandOptionType.User,
            }
        ]
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
    },
    {
        name: 'warn',
        description: 'Ajoute un avertissement à un utilisateur.',
        options: [
            {
                name: 'pseudo',
                description: 'Le pseudo de l\'utilisateur.',
                required: true,
                type: ApplicationCommandOptionType.User,
            },
            {
                name: 'raison',
                description: 'Raison de l\'avertissement.',
                required: true,
                type: ApplicationCommandOptionType.String,
            },
            {
                name: 'link',
                description: 'Lien de d\'une preuve.',
                required: false,
                type: ApplicationCommandOptionType.String,
            }

        ],
    },
    {
        name: 'historique',
        description: 'Affiche la liste des warns d\'un utilisateur.',
        options: [
            {
                name: 'pseudo',
                description: 'Le pseudo de l\'utilisateur.',
                required: true,
                type: ApplicationCommandOptionType.User,
            },
        ],
    },
    {
        name: 'xp',
        description: `Affiche l'xp de l\'utilisateur.`,
    },
    {
        name: 'money',
        description: 'Affiche la money de l\'utilisateur.',
    },
    {
        name: 'reload-reglement',
        description: 'Reload la validation du règlement.',
    },
    {
        name: 'setanniv',
        description: `Permet de régler la date de votre anniversaire. (/!\\ faisable qu'une fois)`,
        options: [
            {
                name: 'jour',
                description: 'Jour de l\'anniversaire.',
                required: true,
                type: ApplicationCommandOptionType.Integer,
            },
            {
                name: 'mois',
                description: 'Mois de l\'anniversaire.',
                required: true,
                type: ApplicationCommandOptionType.Integer,
                choices: [
                    {name: 'Janvier', value: 1},{name: 'Février', value: 2},{name: 'Mars', value: 3},{name: 'Avril', value: 4},{name: 'Mai', value: 5},{name: 'Juin', value: 6},{name: 'Juillet', value: 7},{name: 'Août', value: 8},{name: 'Septembre', value: 9},{name: 'Octobre', value: 10},{name: 'Novembre', value: 11},{name: 'Décembre', value: 12}
                ]
            }
        ]
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
    collector.on('end', () => {
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
    collector.on('end', () => {
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
        interaction.member.setNickname(`${prenom} ${nom}`);
        interaction.guild.channels.cache.find(channel => channel.id === config.REGLEMENT_CHANNEL).permissionOverwrites.create(interaction.member.id, {
            VIEW_CHANNEL: true,
        });
        interaction.channel.delete();
    }

    if (interaction.customId === `cancel`) {
        interaction.reply(`Quel est ton Prénom ?`);
        fcollector(interaction.channel,interaction.member);
    }
});

// Connection des nouveaux membres

bot.on('guildMemberAdd',  member => {
    member.guild.channels.create(`${member.displayName}`, {
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
        channel.send(`Attention à bien remplir ce formulaire, les informations données ne pourront être modifiées que par un modérateur.`);
        //demander le nom / prénom
        channel.send(`Quel est ton Prénom ?`);
        fcollector(channel,member);
    });
});

bot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'ping') {
        await interaction.reply({
            content: `🏓 La latence est de ${Date.now() - interaction.createdTimestamp}ms. La latence de l'API est de ${Math.round(bot.ws.ping)}ms`,
            ephemeral: true
        });
    }

    if (interaction.commandName === 'help') {
        await interaction.reply({
            content: `Voici la liste des commandes : \n\n${commands.map(command => `**${command.name}** : ${command.description}`).join('\n')}`,
            ephemeral: true
        });
    }

    if (interaction.commandName === 'tempmute') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const user = interaction.options.get('pseudo').member;
                if (user.roles.cache.find(role => role.id === config.ROLE_MOD) || user.roles.cache.find(role => role.id === config.ROLE_ADMIN) || user.permissions.has('ADMINISTRATOR')) {
                    interaction.reply({
                        content: `Vous ne pouvez pas mute un modérateur ou un administrateur.`,
                        ephemeral: true
                    });
                } else {
                    const duration = interaction.options.get('durée');
                    const unite = interaction.options.get('unité');
                    const reason = interaction.options.get('raison');
                    let timeToMute = duration.value;
                    let mute_embeds = new MessageEmbed();
                    if (unite.value === 'Minutes') {
                        timeToMute *= 60000;
                    }
                    if (unite.value === 'Heures') {
                        timeToMute *= 3600000;
                    }
                    if (unite.value === 'Jours') {
                        timeToMute *= 86400000;
                    }
                    if (unite.value === 'Semaines') {
                        timeToMute *= 604800000;
                    }
                    if (timeToMute > 2419200000) {
                        timeToMute = 2419200000;
                        user.timeout(timeToMute, reason.value);
                        mute_embeds
                            .setColor('#da461a')
                            .setTitle(`${user.displayName} à été mute par ${interaction.member.displayName}`)
                            .setThumbnail(user.displayAvatarURL())
                            .addFields({
                                name: `Pendant :`,
                                value: `1 Mois (durée Max)`
                            })
                            .setTimestamp()
                            .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
                        interaction.reply({embeds: [mute_embeds]}).then(() => {
                            addSanction(user, reason.value, interaction.member, interaction.channel);
                        });

                    } else {
                        user.timeout(timeToMute, reason.value);
                        mute_embeds
                            .setColor('#da461a')
                            .setTitle(`${user.displayName} à été mute par ${interaction.member.displayName}`)
                            .setThumbnail(user.displayAvatarURL())
                            .addFields({
                                name: `Pendant :`,
                                value: `${duration.value} ${unite.value}`
                            })
                            .setTimestamp()
                            .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
                        interaction.reply({embeds: [mute_embeds]}).then(() => {
                            addSanction(user, reason.value, interaction.member, interaction.channel);
                        });
                    }
                }
            }
        });
    }

    if (interaction.commandName === 'ticket') {
        const user = interaction.member;
        //créer un channel dans la catégorie 899726058943815731
        if (!await ticket_db.has(user.user.id)) {
            const channel = await interaction.guild.channels.create(`ticket-${user.displayName}`, {
                type: 'GUILD_TEXT',
                parent: config.TICKET_CAT,
            });
            await ticket_db.set(channel.id, user.user.id);
            await ticket_db.set(user.user.id, true);
            interaction.reply({content: `Votre ticket a bien été créé.`, ephemeral: true});
            //donner la permission de lecture et d'écriture de user
            await channel.permissionOverwrites.create(interaction.user, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true,
                EMBED_LINKS: true,
                ATTACH_FILES: true,
                READ_MESSAGE_HISTORY: true,
                MANAGE_CHANNELS: true,
            });
            //donner la permission de lecture et d'écriture aux modérateurs
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
            await channel.send({content: `Bienvenue <@${interaction.user.id}> dans votre ticket.`, components: [row]});
        } else {
            interaction.reply({content: 'Vous avez déjà un ticket ouvert.', ephemeral: true});
        }
    }

    if (interaction.commandName === 'adminticket') {
        verificationpermission(interaction).then(async result => {
            if (result) {
                const pseudo = interaction.options.get('pseudo');
                if (!await admin_ticket_db.has(pseudo.user.id)) {
                    interaction.guild.channels.create(`admin-ticket-${pseudo.member.displayName}`, {
                        type: 'GUILD_TEXT',
                        parent: config.TICKET_CAT,
                    }).then(channel => {
                        ticket_db.set(channel.id, pseudo.user.id);
                        ticket_db.set(pseudo.user.id, true);
                        interaction.reply({content: `Votre ticket a bien été créé.`, ephemeral: true});
                        //donner la permission de lecture et d'écriture de user
                        channel.permissionOverwrites.create(pseudo.user, {
                            VIEW_CHANNEL: true,
                            SEND_MESSAGES: true,
                            EMBED_LINKS: true,
                            ATTACH_FILES: true,
                            READ_MESSAGE_HISTORY: true,
                        });
                        //donner la permission de lecture et d'écriture aux modérateurs
                        channel.permissionOverwrites.create(interaction.guild.roles.cache.find(role => role.id === config.ROLE_MOD), {
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
                        channel.send({
                            content: `Bienvenue <@${pseudo.user.id}> dans le ticket de <@${interaction.user.id}>.`,
                            components: [row]
                        });

                    });
                } else {
                    interaction.reply({content: 'Vous avez déjà un admin-ticket ouvert.', ephemeral: true});
                }
            }
        })
    }

    if (interaction.commandName === '1role') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const pseudo = interaction.options.get('pseudo');
                const role = interaction.options.get('role');
                const member = interaction.guild.members.cache.find(user => user.id === pseudo.value);
                const role_to_add = interaction.guild.roles.cache.find(AddRole => AddRole.name === role.value);
                let member_target;
                if (!onerole_db.has(role.value)) {
                    onerole_db.set(role.value, member.user.id).then(() => {
                        member.roles.add(role_to_add).then(() => {
                            interaction.reply({
                                content: `Le role ${role.value} a bien été attribué à ${member.displayName}.`,
                                ephemeral: true
                            });
                        });
                    });
                } else {
                    onerole_db.get(role.value).then(target => {
                        member_target = interaction.guild.members.cache.find(user => user.id === target);
                        member_target.roles.remove(role_to_add);
                        onerole_db.set(role.value, member.user.id).then(() => {
                            member.roles.add(role_to_add).then(() => {
                                interaction.reply({
                                    content: `Le role ${role.value} a bien été attribué à ${member.displayName}.`,
                                    ephemeral: true
                                });
                            });
                        });
                    })
                }

            }
        })
    }

    if (interaction.commandName === 'github') {
        //bouton pour ouvrir le lien github
        const GithubLink = new MessageActionRow().addComponents(
            new MessageButton()
                .setLabel('Github')
                .setStyle('LINK')
                .setURL('https://github.com/Cyriaque-TONNERRE/Chanael/')
        );
        interaction.reply({
            content: `Ci-dessous le github du bot, n'hésitez pas si vous trouvez des erreurs et/ou si vous voulez proposer des fonctionnalités **utiles**.`,
            components: [GithubLink],
            ephemeral: true
        });
    }
    if (interaction.commandName === 'warn') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const membre = interaction.options.get('pseudo');
                if (membre.member.roles.cache.find(role => role.id === config.ROLE_MOD) || membre.member.roles.cache.find(role => role.id === config.ROLE_ADMIN) || membre.member.permissions.has('ADMINISTRATOR')) {
                    interaction.reply({
                        content: `Vous ne pouvez pas warn----------- un modérateur ou un administrateur.`,
                        ephemeral: true
                    });
                } else {
                    const reason = interaction.options.get('raison');
                    const link = interaction.options.get('link');
                    if (link === null) {
                        addSanction(membre.user, reason.value, interaction.member, interaction.channel);
                    } else {
                        addSanction(membre.user, reason.value, interaction.member, interaction.channel, link.value);
                    }
                    const sanctionEmbed = new MessageEmbed()
                        .setColor('#da461a')
                        .setTitle(`${membre.member.displayName} à été sanctionné par ${interaction.member.displayName}`)
                        .setThumbnail(membre.user.displayAvatarURL())
                        .addFields({
                            name: `Raison :`,
                            value: `${reason.value}`,
                        })
                        .setTimestamp()
                        .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
                    interaction.reply({embeds: [sanctionEmbed]});
                }
            }
        })
    }
    if (interaction.commandName === 'historique') {
        function timestampToDate(timestamp) {
            const date = new Date(timestamp);
            const day = date.getDate();
            const month = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Décembre"];
            const mois = month[date.getMonth()];
            const year = date.getFullYear();
            const hours = date.getHours();
            const minutes = date.getMinutes();
            return `Le ${day} ${mois} ${year} à ${hours}:${minutes}`;
        }

        const membre = interaction.options.get('pseudo').member;
        const sanctionEmbed = new MessageEmbed();
        const list = await sanction_db.get(membre.user.id);
        if (list === undefined) {
            sanctionEmbed
                .setColor('#3dd583')
                .setTitle(`Sanctions de ${membre.displayName}`)
                .setThumbnail(membre.displayAvatarURL())
                .addFields({
                    name: `**Sanction :**`,
                    value: `Aucune sanction n'a été ajoutée à ce membre. GG`
                })
                .setTimestamp()
                .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
        } else {
            sanctionEmbed
                .setColor('#3dd583')
                .setTitle(`Sanctions de ${membre.displayName}`)
                .setThumbnail(membre.user.displayAvatarURL())
                .addFields(
                    list.map(s => {
                        return {
                            name: `**Sanction pour** : ${s.reason}`,
                            value: `${timestampToDate(s.timestamp)}\n**Par :** ${interaction.guild.members.cache.find(user => user.id === s.modo).displayName}`
                        }
                    })
                )
                .setTimestamp()
                .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
        }
        interaction.reply({embeds: [sanctionEmbed]});
    }
    if (interaction.commandName === 'reload-reglement') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const embed_reglement = new MessageEmbed()
                    .setColor('#da461a')
                    .setTitle('Acceptez le règlement de Promo 67, 5 pour accéder à l\'intégralité du serveur')
                    .setDescription('Pour accepter le règlement du serveur veuillez interagir avec la réaction ci-dessous !\n')
                const accep_reglement = new MessageActionRow().addComponents(
                    new MessageButton()
                        .setCustomId('accept_reglement')
                        .setLabel('Accepter')
                        .setStyle('SUCCESS'),
                );
                const reglement_channel = bot.channels.cache.get(config.REGLEMENT_CHANNEL);
                reglement_channel.messages.fetch(reglement_channel.lastMessageId).then(message => {
                    message.delete().then(() => {
                        reglement_channel.send({embeds: [embed_reglement], components: [accep_reglement]}).then(() => {
                            interaction.reply({content: 'Le règlement a été reload !', ephemeral: true});
                        });
                    });
                });
            }
        })
    }
    if (interaction.commandName === 'setanniv') {
        if (await bday_db.has(interaction.member.id)) {
            interaction.reply({
                content: `Votre anniversaire est deja régler, si il y a un problème ➡️  contactez un modérateur.`,
                ephemeral: true
            });
        } else {
            const jour = interaction.options.get('jour');
            if (jour.value < 1 || jour.value > 31) {
                interaction.reply({content: `Veuillez entrer un jour valide (1-31).`, ephemeral: true});
            } else {
                const mois = interaction.options.get('mois');
                await bday_db.set(interaction.member.id, {jour: jour.value, mois: mois.value});
                interaction.reply({content: `Votre anniversaire a bien été régler.`, ephemeral: true});
            }
        }
    }
    if (interaction.commandName === 'xp') {
        const membre = interaction.member;
        const xp_embed = new MessageEmbed()
        if (await xp_db.has(membre.user.id)) {
            xp_db.get(membre.user.id).then(user => {
                xp_embed
                    .setColor('#3dd583')
                    .setTitle(`XP de ${membre.displayName}`)
                    .setThumbnail(membre.user.displayAvatarURL())
                    .addFields({
                            name: `**Niveau :**`,
                            value: `${user.level}`,
                            inline: true
                        },
                        {
                            name: `**XP :**`,
                            value: `${user.xp} / ${maths.round((3 * user.level + 150) * (1.05 ** user.level))}`,
                            inline: true
                        })
                    .setTimestamp();
                interaction.reply({embeds: [xp_embed]});
            });
        } else {
            xp_db.get(membre.user.id).then(user => {
                xp_embed
                    .setColor('#3dd583')
                    .setTitle(`XP de ${membre.displayName}`)
                    .setThumbnail(membre.user.displayAvatarURL())
                    .addFields({
                            name: `**Niveau :**`,
                            value: `0`,
                            inline: true
                        },
                        {
                            name: `**XP :**`,
                            value: `0 / 150`,
                            inline: true
                        })
                    .setTimestamp();
                interaction.reply({embeds: [xp_embed]});
            });
        }
    }
    if (interaction.commandName === 'money') {
        const membre = interaction.member;
        const money_embed = new MessageEmbed()
        if (await money_db.has(membre.user.id)) {
            money_db.get(membre.user.id).then(user => {
                money_embed
                    .setColor('#d5d03d')
                    .setTitle(`Money de ${membre.displayName}`)
                    .setThumbnail(membre.user.displayAvatarURL())
                    .addFields({
                        name: `**Money :**`,
                        value: `${user.money}`,
                        inline: true
                    })
                    .setTimestamp();
                interaction.reply({embeds: [money_embed]});
            });
        } else {
            money_db.get(membre.user.id).then(user => {
                money_embed
                    .setColor('#d5d03d')
                    .setTitle(`Money de ${membre.displayName}`)
                    .setThumbnail(membre.user.displayAvatarURL())
                    .addFields({
                        name: `**Money :**`,
                        value: `0`,
                        inline: true
                    })
                    .setTimestamp();
                interaction.reply({embeds: [money_embed]});
            });
        }
    }
});

bot.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === `end_ticket`) {
        if (interaction.member.roles.cache.some((role) => role.id === config.ROLE_MOD) || interaction.member.permissions.has("ADMINISTRATOR")) {
            interaction.channel.delete();
            if (await ticket_db.has(interaction.channel.id)) {
                await ticket_db.delete(await ticket_db.get(interaction.channel.id));
                await ticket_db.delete(interaction.channel.id);
            }
            if (await admin_ticket_db.has(interaction.channel.id)) {
                await admin_ticket_db.delete(await admin_ticket_db.get(interaction.channel.id));
                await admin_ticket_db.delete(interaction.channel.id);
            }
        } else {
            interaction.reply({content: 'Vous n\'avez pas la permission de faire cela.', ephemeral: true});
        }
    }
    if (interaction.customId === `accept_reglement`) {
        let has_accepted = false;
        config.ALL_MAIN_ROLE.forEach(role => {
            if (interaction.member.roles.cache.has(role)) {
                has_accepted = true;
            }
        });
        if (!has_accepted) {
            interaction.guild.roles.fetch(config.MAIN_ROLE).then(role => {
                interaction.member.roles.add(role).then(() => {
                    const bienvenue = ["Bienvenue", "Welcome", "Willkommen", "Bienvenidos", "Bem-vindo", "Witam", "Dobrodošli"]
                    const embed_bienvenue = new MessageEmbed()
                        .setColor('#cc532e')
                        .setTitle('Ho ! Un nouveau membre !')
                        .setDescription(`${bienvenue[randomInt(0, 7)]} sur le serveur de Promo 67,5! :beers:\n`)
                        .setThumbnail(interaction.member.user.displayAvatarURL())
                        .setImage('http://cyriaque.tonnerre.free.fr/welcome.png')
                    interaction.guild.channels.fetch(config.BIENVENUE_CHANNEL).then(channel => {
                        channel.send({content: `<@${interaction.member.user.id}>`, embeds: [embed_bienvenue]});
                    });
                });
            });
        }
        interaction.reply({content: 'Vous avez accepté le règlement.', ephemeral: true});
    }
});

bot.on('channelDelete', async channel => {
    if (await ticket_db.has(channel.id)) {
        await ticket_db.delete(await ticket_db.get(channel.id));
        await ticket_db.delete(channel.id);
    }
    if (await admin_ticket_db.has(channel.id)) {
        await admin_ticket_db.delete(await admin_ticket_db.get(channel.id));
        await admin_ticket_db.delete(channel.id);
    }
})

bot.on('ready', () => {
    console.log('Bot is ready !');
    console.log(`Logged in as ${bot.user.tag}`);
    console.log(`ID: ${bot.user.id}`);
    /*
    if (!xp_db.has('nb_user')){
        xp_db.set('nb_user', 0);
        xp_db.set('order_user', []);
    }
    if (!money_db.has('nb_user')){
        money_db.set('nb_user', 0);
        money_db.set('order_user', []);
    }
    */
});

cron.schedule('0 8 * * *', async () => {
    await bday_db.all().then(list => {
        forEach(list, (elem) => {
            if (elem.value.jour === new Date().getDate() && elem.value.mois === new Date().getMonth() + 1) {
                const bdaygif = ["https://media3.giphy.com/media/SwIMZUJE3ZPpHAfTC4/giphy.gif", "https://tenor.com/Y8iY.gif", "https://tenor.com/bBJpT.gif", "https://tenor.com/bRZjc.gif", "https://tenor.com/bNoxv.gif", "https://tenor.com/bdecb.gif", "https://i.pinimg.com/originals/11/68/82/116882088dc7f44d5cc3d3377f963c70.gif", "https://thumbs.gfycat.com/RepentantUnpleasantFantail-size_restricted.gif", "https://imgur.com/34YQYmg", "https://media.giphy.com/media/oXpZ1sLkbCZ9jFhBMx/giphy.gif", "https://hurfat.com/wp-content/uploads/2021/07/Happy-Birthday...-22.gif", "https://i.pinimg.com/originals/28/35/2f/28352f4f85ebb3ff4019c0b4a2dd0092.gif", "https://cdn.discordapp.com/attachments/987748619010576424/996437041199992985/b5ae8413d8b1167720f3804fb58faaf8.gif", "https://cdn.discordapp.com/attachments/987748619010576424/996437061819170966/giphy.gif", "https://cdn.discordapp.com/attachments/987748619010576424/996437151367565392/Gvb.gif", "https://cdn.discordapp.com/attachments/987748619010576424/1000099809346211890/Untitled111.gif"];
                const member = bot.guilds.cache.get(config.GUILD_ID).members.cache.get(elem.id);
                if (member) {
                    const embed_bday = new MessageEmbed()
                        .setColor('#cc532e')
                        .setTitle('Joyeux Anniversaire ! 🎉')
                        .setDescription(`Aujourd'hui c'est l'anniversaire de <@${member.user.id}> ! 🎈 🎂 🎊\n`)
                        .setThumbnail(bdaygif[randomInt(0, 16)])
                        .setFooter({
                            text: 'Pensez à lui faire sa fête bande de BG',
                            iconURL: `https://twemoji.maxcdn.com/v/latest/72x72/1f61c.png`
                        })
                    bot.guilds.cache.get(config.GUILD_ID).channels.fetch(config.ANNIVERSAIRE_CHANNEL).then(channel => {
                        channel.send({embeds: [embed_bday]});
                    });
                }
            }
        });
    });
}, {
    scheduled: true,
    timezone: "Europe/Paris"
});

bot.on('guildMemberRemove', async member => {
    if (await bday_db.has(member.id)){
        await bday_db.delete(member.id);
    }
});

async function lvl_up(message) {
    xp_db.get(message.author.id).then(user => {
        let channel = message.guild.channels.cache.find(channel => channel.id === config.BOT_CHANNEL);
        let name = message.guild.members.cache.find(user => user.id === message.author.id).displayName
        if (user.xp >= maths.round((3 * user.level + 150) * (1.05 ** user.level))) {
            let lvlupEmbed = new MessageEmbed()
                .setColor('#0162b0')
                .setTitle(`Bravo ${name} !`)
                .setThumbnail(message.author.displayAvatarURL())
                .setDescription(`Vous avez atteint le niveau ${user.level + 1} !`)
                .setTimestamp()
                .setFooter({text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
            xp_db.set(message.author.id, {
                xp: user.xp - maths.round((3 * user.level + 150) * (1.05 ** user.level)),
                level: user.level + 1,
                timestamp: Date.now()
            }).then(() => {
                channel.send({content: `Bravo <@${message.author.id}>, tu viens de monter d'un niveau`, embeds: [lvlupEmbed]});
            });
        }
    });
}

bot.on('messageCreate', async (message) => {
    if (message.author.id !== bot.user.id) {
        if (!await xp_db.has(message.author.id)) {
            let User = {};
            User.xp = 0;
            User.level = 0;
            User.timestamp = Date.now();
            await xp_db.set(message.author.id, User);
        } else {
            xp_db.get(message.author.id).then(async user => {
                if (user.timestamp + 1000 <= Date.now()) {
                    await xp_db.set(message.author.id, {
                        xp: user.xp + maths.round(maths.random(3, 12)),
                        level: user.level,
                        timestamp: Date.now()
                    });
                    lvl_up(message);
                }
            });
        }
    }
});


bot.login(config.BOT_TOKEN);