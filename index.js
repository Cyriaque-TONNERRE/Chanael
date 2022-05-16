const DataBase = require('easy-json-database');
const latex = require('node-latex');
const fs = require('fs');
const pdftoimage = require('node-pdftocairo')

const { Client, Intents, MessageButton, MessageActionRow, MessageEmbed} = require('discord.js');
const bot = new Client({ intents: "32767"});

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const {ApplicationCommandOptionType} = require("discord-api-types/v10");


const config = require('./config.json');

const ticket_db = new DataBase('./ticket.json', {});
const onerole_db = new DataBase('./onerole.json', {});
const sanction_db = new DataBase('./sanction.json', {});
const nb_sanction_db = new DataBase('./nb_sanction.json', {});

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
                description: 'Unité de temps. (Max 28 jours / 1 mois)',
                required: true,
                type: ApplicationCommandOptionType.String,
                choices:[
                    {
                        name: 'Secondes',
                        value: 'Secondes',
                    },
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
                    },
                    {
                        name: 'Mois',
                        value: 'Mois',
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
    /*{
        name: 'tex',
        description: 'Affiche une expression écrite en LaTeX.',
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
        const duration = interaction.options.get('durée');
        const unite = interaction.options.get('unité');
        const reason = interaction.options.get('raison');
        const user = interaction.guild.members.cache.find(user => user.id === pseudo.value);
        let timeToMute = duration.value;
        console.log(unite);
        if (unite.value === 'Secondes') {
            timeToMute *= 1000;
        }
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
        if (unite.value === 'Mois') {
            timeToMute *= 2419200000;
        }
        if (timeToMute > 2419200000) { timeToMute = 2419200000; }
        user.timeout(timeToMute, reason.value);
        interaction.reply(`${user.displayName} a été mute pendant ${duration.value} ${unite.value}.`);
        addSanction(user, reason.value, interaction.member, interaction.channel);
    }MessageEmbed

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
        interaction.reply({content: `Le role ${role.value} a bien été attribué à ${user.displayName}.`, ephemeral: true});
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
    function convertToPng(error, interaction) {
        console.log("2");
        const options = {
            format: 'png',
            resolution: '600',
            transparent: true,
            originPageSizes: true,


        };
        const outputBuffer = pdftoimage.input('tex/output.pdf', options).output('tex/output').then(() => {
            console.log("3");
            if (error === undefined) {
                console.log("4");
                interaction.channel.send({files: ['./tex/output-1.png']});
                console.log("5");
            } else {
                interaction.channel.send({content: `${error}`, ephemeral: true});
            }
        });
    }

    const filtre = m => m.author.id === interaction.user.id;
    if (interaction.commandName === 'tex') {
        interaction.reply({content: `Vous pouvez envoyer ci-dessous votre code LaTeX, envoyer "option" pour afficher les options LaTeX ou bien "cancel" pour annuler la commande.`, ephemeral: true});
        //ouvrir un collector pour envoyer le texte
        const tcollector = interaction.channel.createMessageCollector({filter: filtre, max: 1, timeout: 60000});
        tcollector.on('collect', async (message) => {
            console.log(message.content);
            if (message.content.toLowerCase() === 'option') {
                tcollector.stop();
                interaction.channel.send(`\`\`\`latex\n
\\documentclass[varwidth=true, border=1pt, convert={size=640x}]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage{amsfonts}
\\begin{document}
$VOTRE CODE LaTeX ICI$
\\end{document}\`\`\``).then(() => {
                    message.delete();
                });
            } else if (message.content.toLowerCase() === 'cancel') {
                message.delete();
                tcollector.stop();
            } else {
                const okstring = message.content.replace(/\\/g, '\\\\');
                tcollector.stop();
                message.delete();
                const input = `\\documentclass[varwidth=true, border=1pt, convert={size=640x}]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage{amsfonts}
\\begin{document}
$${okstring}$
\\end{document}`;
                let error;
                console.log(input);
                const output = fs.createWriteStream('tex/output.pdf')
                const pdf = latex(input)
                pdf.pipe(output)
                pdf.on('error', err => error = err)
                console.log("1");
                pdf.on('end', () => setTimeout(convertToPng(error, interaction), 2000));

            }
        });
    };
    if (interaction.commandName === 'warn') {
        const membre = interaction.options.get('pseudo');
        const reason = interaction.options.get('raison');
        const link = interaction.options.get('link');
        if (link === null) {
            addSanction(membre.user, reason.value, interaction.member, interaction.channel);
        } else {
            addSanction(membre.user, reason.value, interaction.member, interaction.channel, link.value);
        }
        interaction.reply({content: `La sanction a bien été ajoutée.`, ephemeral: true});
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
        const sanctionEmbed = new MessageEmbed()
            .setColor('#3dd583')
            .setTitle(`Sanctions de ${membre.member.displayName}`)
            .setAuthor({ name: 'Chanael', iconURL: bot.user.displayAvatarURL()})
            //.setDescription('Some description here')
            .setThumbnail(membre.user.displayAvatarURL())
            .addFields(
                sanction_db.get(membre.user.id).map(s => {
                    return {//i.imgur.com/AfFp7pu.png
                        name: `**Sanction pour** : ${s.reason}`,
                        value: `${timestampToDate(s.timestamp)}\n**Par :** ${interaction.guild.members.cache.find(user => user.id === s.modo).displayName}`
                    }
                })
                /*{ name: 'Regular field title', value: 'Some value here' },
                { name: 'Inline field title', value: 'Some value here', inline: true },
                { name: 'Inline field title', value: 'Some value here', inline: true },*/
            )
            .setTimestamp()
            .setFooter({ text: `Rappel du réglement : <#${config.REGLEMENT_CHANNEL}>`, iconURL: 'https://pngimg.com/uploads/hitler/hitler_PNG33.png' });

        interaction.reply({embeds: [sanctionEmbed]});
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