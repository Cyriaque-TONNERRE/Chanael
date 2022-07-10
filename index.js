const DataBase = require('easy-json-database');
const latex = require('node-latex');
const fs = require('fs');
const pdftoimage = require('node-pdftocairo')
const maths = require('mathjs');
const cron = require('node-cron');

const { Client, MessageButton, MessageActionRow, MessageEmbed} = require('discord.js');
const bot = new Client({ intents: "32767"});

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {ApplicationCommandOptionType} = require("discord-api-types/v10");

const config = require('./config.json');
const {randomInt, forEach} = require("mathjs");

const ticket_db = new DataBase('./ticket.json', {});
const admin_ticket_db = new DataBase('./admin_ticket.json', {});
const onerole_db = new DataBase('./onerole.json', {});
const sanction_db = new DataBase('./sanction.json', {});
const nb_sanction_db = new DataBase('./nb_sanction.json', {});
const xp_db = new DataBase('./xp.json', {});
const bday_db = new DataBase('./bday.json', {});

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
    console.log(member.id);
    if (!sanction_db.has(member.id)) {
        sanction_db.set(member.id,[sanction]);
    } else {
        sanction_db.push(member.id, sanction);
    }
    if (!nb_sanction_db.has(member.id)) {
        nb_sanction_db.set(member.id, 1);
    } else {
        const nb_sanction_increase = nb_sanction_db.get(member.id) + 1;
        console.log(nb_sanction_increase);
        nb_sanction_db.set(member.id, nb_sanction_increase);
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
    const nb_sanction = nb_sanction_db.get(member.id);
    if (nb_sanction >= 10) {
        member.timeout(604800000, "Auto-Sanction");
        channel.send(`${member.displayName} a été réduit au silence 7 jours pour avoir commis ${nb_sanction} infractions au règlement.`);
    } else if (nb_sanction === 7) {
        member.timeout(259200000, "Auto-Sanction");
        channel.send(`${member.displayName} a été réduit au silence 3 jours pour avoir commis 7 infractions au règlement.`);
    } else if (nb_sanction === 5) {
        member.timeout(86400000, "Auto-Sanction");
        channel.send(`${member.displayName} a été réduit au silence 1 jours pour avoir commis 5 infractions au règlement.`);
    } else if (nb_sanction === 3) {
        member.timeout(21600000, "Auto-Sanction");
        channel.send(`${member.displayName} a été réduit au silence 1 heure pour avoir commis 3 infractions au règlement.`);
    } else {
        channel.send(`${member.displayName} a commis ${nb_sanction} infractions au règlement.`);
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
    },/*
    {
        name: 'tex',
        description: 'Affiche une expression écrite en LaTeX.',
        options: [
            {
                name: 'option',
                description: 'Les options latex.',
                required: false,
                type: ApplicationCommandOptionType.String,
                choices:
                   [
                       {
                           name: 'true',
                           value: 'true',
                       }
                   ]
            },
        ],
    },*/
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
        description: 'Affiche les xp de l\'utilisateur.',
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
        await interaction.reply({ content : `🏓 La latence est de ${Date.now() - interaction.createdTimestamp}ms. La latence de l'API est de ${Math.round(bot.ws.ping)}ms`, ephemeral: true });
    }

    if (interaction.commandName === 'help') {
        await interaction.reply({ content : `Voici la liste des commandes : \n\n${commands.map(command => `**${command.name}** : ${command.description}`).join('\n')}`, ephemeral: true});
    }

    if (interaction.commandName === 'tempmute') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const pseudo = interaction.options.get('pseudo');
                if (pseudo.member.roles.cache.find(role => role.id === config.ROLE_MOD) || pseudo.member.roles.cache.find(role => role.id === config.ROLE_ADMIN) || pseudo.member.permissions.has('ADMINISTRATOR')) {
                    interaction.reply({content:`Vous ne pouvez pas mute un modérateur ou un administrateur.`, ephemeral: true});
                } else {
                    const duration = interaction.options.get('durée');
                    const unite = interaction.options.get('unité');
                    const reason = interaction.options.get('raison');
                    const user = interaction.guild.members.cache.find(user => user.id === pseudo.value);
                    let timeToMute = duration.value;
                    console.log(unite);
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
                        interaction.reply(`${user.displayName} a été mute pendant 1 mois (durée max).`);
                        addSanction(user, reason.value, interaction.member, interaction.channel);
                    } else {
                        user.timeout(timeToMute, reason.value);
                        interaction.reply(`${user.displayName} a été mute pendant ${duration.value} ${unite.value}.`);
                        addSanction(user, reason.value, interaction.member, interaction.channel);
                    }
                }
            }
        });
    }

    if (interaction.commandName === 'ticket') {
        const user = interaction.member;
        //créer un channel dans la catégorie 899726058943815731
        if (!ticket_db.has(user.user.id)){
            const channel = await interaction.guild.channels.create(`ticket-${user.displayName}`, {
                type: 'GUILD_TEXT',
                parent: config.TICKET_CAT,
            });
            ticket_db.set(channel.id, user.user.id);
            ticket_db.set(user.user.id, true);
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
            channel.send({content: `Bienvenue <@${interaction.user.id}> dans votre ticket.` ,components: [row]});
        }else{
            interaction.reply({content: 'Vous avez déjà un ticket ouvert.', ephemeral: true});
        }
    }

    if (interaction.commandName === 'adminticket') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const pseudo = interaction.options.get('pseudo');
                if (!admin_ticket_db.has(pseudo.user.id)){
                    const channel = interaction.guild.channels.create(`admin-ticket-${pseudo.member.displayName}`, {
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
                        channel.send({content: `Bienvenue <@${pseudo.user.id}> dans le ticket de <@${interaction.user.id}>.` ,components: [row]});

                    });
                }else{
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
                const user = interaction.guild.members.cache.find(user => user.id === pseudo.value);
                const role_to_add = interaction.guild.roles.cache.find(AddRole => AddRole.name === role.value);
                let target;
                // supprimer le role à tous ceux qui ont le role
                if (onerole_db.has(role.value)) {
                    target = interaction.guild.members.cache.find(user => user.id === onerole_db.get(role.value));
                    target.roles.remove(role_to_add);
                    onerole_db.set(role.value, user.user.id);
                    user.roles.add(role_to_add);
                } else {
                    onerole_db.set(role.value, user.user.id);
                    user.roles.add(role_to_add);
                }
                interaction.reply({content: `Le role ${role.value} a bien été attribué à ${user.displayName}.`, ephemeral: true});
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
        interaction.reply({content: `Ci-dessous le github du bot, n'hésitez pas si vous trouvez des erreurs et/ou si vous voulez proposer des fonctionnalités **utiles**.`,components: [GithubLink], ephemeral: true});
    }
    function convertToPng() {
        const options = {
            format: 'png',
            resolution: '600',
            transparent: true,
            originPageSizes: true,
        };
        console.log('problème ici');
        pdftoimage.input('tex/output.pdf', options).output('tex/output')
    }

    const filtre = m => m.author.id === interaction.user.id;
    if (interaction.commandName === 'tex') {
        const option = interaction.options.get('option');
        if (option !== null) {
            interaction.channel.send(`\`\`\`latex` +
                `\\documentclass[varwidth=true, border=1pt, convert={size=640x}]{standalone}` +
                `\\usepackage[utf8]{inputenc}`+
                `\\usepackage{amsfonts}` +
                `\\begin{document}` +
                `$VOTRE CODE LaTeX ICI$` +
                `\\end{document}\`\`\``);
        } else {
            interaction.reply({content: `Vous pouvez envoyer ci-dessous votre code LaTeX.`, ephemeral: true});
            let okstring;
            const tcollector = interaction.channel.createMessageCollector({filter: filtre, max: 1, time: 60000});
            tcollector.on('collect', (message) => {
                okstring = message.content.replace(/\\/g, '\\\\');
                message.delete();
            })
            tcollector.on('end', (collected) => {
                if(collected.size === 0){
                    interaction.editReply({content: `Commande annulée, vous n'avez pas envoyé de code LaTeX.`, ephemeral: true});
                } else {
                    const input = `\\documentclass[varwidth=true, border=1pt, convert={size=640x}]{standalone}` +
                        `\\usepackage[utf8]{inputenc}` +
                        `\\usepackage{amsfonts}` +
                        `\\begin{document}` +
                        `$${okstring}$` +
                        `\\end{document}`;
                    const output = fs.createWriteStream('tex/output.pdf')
                    const pdf = latex(input)
                    pdf.pipe(output)
                    pdf.on('error', err => interaction.editReply(err));
                    pdf.on('finish', () => convertToPng());
                }
            });
        }
    }
    if (interaction.commandName === 'warn') {
        verificationpermission(interaction).then(result => {
            if (result) {
                const membre = interaction.options.get('pseudo');
                if (membre.member.roles.cache.find(role => role.id === config.ROLE_MOD) || membre.member.roles.cache.find(role => role.id === config.ROLE_ADMIN) || membre.member.permissions.has('ADMINISTRATOR')) {
                    interaction.reply({content:`Vous ne pouvez pas mute un modérateur ou un administrateur.`, ephemeral: true});
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

        function timestampToDate (timestamp) {
            const date = new Date(timestamp);
            const day = date.getDate();
            const month = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Décembre"];
            const mois = month[date.getMonth()];
            const year = date.getFullYear();
            const hours = date.getHours();
            const minutes = date.getMinutes();
            return `Le ${day} ${mois} ${year} à ${hours}:${minutes}`;
        }

        const membre = interaction.options.get('pseudo');
        let sanctionEmbed;
        if (nb_sanction_db.get(membre.user.id) === undefined){
            sanctionEmbed = new MessageEmbed()
                .setColor('#3dd583')
                .setTitle(`Sanctions de ${membre.member.displayName}`)
                .setThumbnail(membre.user.displayAvatarURL())
                .addFields({
                    name: `**Sanction :**`,
                    value: `Aucune sanction n'a été ajoutée à ce membre. GG`
                })
                .setTimestamp()
                .setFooter({ text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
        } else {
            sanctionEmbed = new MessageEmbed()
            .setColor('#3dd583')
            .setTitle(`Sanctions de ${membre.member.displayName}`)
            .setThumbnail(membre.user.displayAvatarURL())
            .addFields(
                sanction_db.get(membre.user.id).map(s => {
                    return {//i.imgur.com/AfFp7pu.png
                        name: `**Sanction pour** : ${s.reason}`,
                        value: `${timestampToDate(s.timestamp)}\n**Par :** ${interaction.guild.members.cache.find(user => user.id === s.modo).displayName}`
                    }
                })
            )
            .setTimestamp()
            .setFooter({ text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
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
                const reglement_channel = bot.channels.cache.find(channel => channel.id === config.REGLEMENT_CHANNEL);
                reglement_channel.messages.fetch(reglement_channel.lastMessageId).then(message => {
                    message.delete().then(() => {
                        reglement_channel.send({embeds:[embed_reglement], components: [accep_reglement]});
                    });
                });
            }
        })
    }
    if (interaction.commandName === 'setanniv') {
        if (bday_db.has(interaction.member.id)) {
            interaction.reply({content: `Votre anniversaire est deja régler, si il y a un problème ➡️  contactez un modérateur.`, ephemeral: true});
        } else {
            const jour = interaction.options.get('jour');
            if (jour.value < 1 || jour.value > 31) {
                interaction.reply({content: `Veuillez entrer un jour valide (1-31).`, ephemeral: true});
            } else {
                const mois = interaction.options.get('mois');
                bday_db.set(interaction.member.id, {jour: jour.value, mois: mois.value});
                interaction.reply({content: `Votre anniversaire a bien été régler.`, ephemeral: true});
            }
        }
    }
});

bot.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === `end_ticket`){
        if(interaction.member.roles.cache.some((role) => role.id === config.ROLE_MOD) || interaction.member.permissions.has("ADMINISTRATOR")){
            interaction.channel.delete();
            if (ticket_db.has(interaction.channel.id)){
                ticket_db.delete(ticket_db.get(interaction.channel.id));
                ticket_db.delete(interaction.channel.id);
            }
            if (admin_ticket_db.has(interaction.channel.id)){
                admin_ticket_db.delete(admin_ticket_db.get(interaction.channel.id));
                admin_ticket_db.delete(interaction.channel.id);
            }
        } else {
            interaction.reply({content: 'Vous n\'avez pas la permission de faire cela.', ephemeral: true});
        }
    }
    if (interaction.customId === `accept_reglement`){
        let has_accepted = false;
        config.ALL_MAIN_ROLE.forEach(role => {
            if (interaction.member.roles.cache.has(role)){
                has_accepted = true;
            }
        });
        if (!has_accepted){
            const cir1 = interaction.guild.roles.fetch(config.MAIN_ROLE).then(role => {
                interaction.member.roles.add(role).then(() => {
                    const bienvenue = ["Bienvenue","Welcome","Willkommen","Bienvenidos","Bem-vindo","Witam","Dobrodošli"]
                    const embed_bienvenue = new MessageEmbed()
                        .setColor('#cc532e')
                        .setTitle('Ho ! Un nouveau membre !')
                        .setDescription(`${bienvenue[randomInt(0,7)]} sur le serveur de Promo 67,5! :beers:\n`)
                        .setThumbnail(interaction.member.user.displayAvatarURL())
                        .setImage('http://cyriaque.tonnerre.free.fr/welcome.png')
                    interaction.guild.channels.fetch(config.BIENVENUE_CHANNEL).then(channel => {
                        channel.send({content: `<@${interaction.member.user.id}>`,embeds:[embed_bienvenue]});
                    });
                });
            });
        }
        interaction.reply({content: 'Vous avez accepté le règlement.', ephemeral: true});
    }
});

bot.on('channelDelete', channel => {
    if (ticket_db.has(channel.id)) {
        ticket_db.delete(ticket_db.get(channel.id));
        ticket_db.delete(channel.id);
    }
    if (admin_ticket_db.has(channel.id)) {
        admin_ticket_db.delete(admin_ticket_db.get(channel.id));
        admin_ticket_db.delete(channel.id);
    }
})

bot.on('ready', () => {
    console.log('Bot is ready !');
    console.log(`Logged in as ${bot.user.tag}`);
    console.log(`ID: ${bot.user.id}`);
});

cron.schedule('0 8 * * *', () => {
    forEach(bday_db.all(), (value) => {
        if (value.data.jour === new Date().getDate() && value.data.mois === new Date().getMonth()+1){
            const member = bot.guilds.cache.get(config.GUILD_ID).members.cache.get(value.key);
            if (member){
                const embed_bday = new MessageEmbed()
                    .setColor('#cc532e')
                    .setTitle('Joyeux Anniversaire ! 🎉')
                    .setDescription(`Aujourd'hui c'est l'anniversaire de <@${member.user.id}> ! 🎈 🎂 🎊\n`)
                    .setThumbnail('https://media3.giphy.com/media/SwIMZUJE3ZPpHAfTC4/giphy.gif?cid=ecf05e47m1z2mj0d34wxyraw7l698fcs783am4j2brokrgje&rid=giphy.gif&ct=g')
                    .setFooter({ text: 'Pensez à lui faire sa fête bande de BG', iconURL: 'https://twemoji.maxcdn.com/v/latest/svg/1f61c.svg' })
                bot.guilds.cache.get(config.GUILD_ID).channels.fetch(config.ANNIVERSAIRE_CHANNEL).then(channel => {
                    channel.send({embeds:[embed_bday]});
                });
            }
        }
    });
}, {
    scheduled: true,
    timezone: "Europe/Paris"
});

function lvl_up(message){
    let xp = xp_db.get(message.author.id).xp;
    let lvl = xp_db.get(message.author.id).level;
    let channel = message.guild.channels.cache.find(channel => channel.id === config.BOT_CHANNEL);
    let name = message.guild.members.cache.find(user => user.id === message.author.id).displayName;
    const size = 100;
    console.log(xp_db.get(message.author.id));
    if (xp >= maths.round((3 * lvl + 150) * (1.05 ** lvl))) {
        let lvlupEmbed = new MessageEmbed()
            .setColor('#0162b0')
            .setTitle(`Bravo ${name} !`)
            .setThumbnail(message.author.displayAvatarURL())
            .setDescription(`Vous avez atteint le niveau ${lvl+1} !`)
            .setTimestamp()
            .setFooter({ text: 'Chanael', iconURL: bot.user.displayAvatarURL()});
        xp_db.set(message.author.id, {xp: xp - maths.round((3 * lvl + 150) * (1.05 ** lvl)), level: lvl + 1, timestamp: Date.now()});
        channel.send({content:`Bravo <@${message.author.id}>, tu viens de monter d'un niveau`, embeds: [lvlupEmbed]});
    }
}
/*
bot.on('messageCreate', (message) => {
    if (message.author.id !== bot.user.id) {
        if (!xp_db.has(message.author.id)){
            let User = {};
            User.xp = 0;
            User.level = 0;
            User.timestamp = Date.now();
            xp_db.set(message.author.id, User);
        } else {
            if (xp_db.get(message.author.id).timestamp + 1000 < Date.now()){
                xp_db.set(message.author.id, {xp: xp_db.get(message.author.id).xp + maths.round(maths.random(3,12)), level: xp_db.get(message.author.id).level, timestamp: Date.now()});
                lvl_up(message);
            }
        }
    }
});
*/

bot.login(config.BOT_TOKEN);