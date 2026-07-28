const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    StringSelectMenuBuilder,
    ButtonStyle, 
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const activeTickets = new Map();

client.on('ready', () => {
    console.log(`🤖 بوت التكتات جاهز ومتصل باسم: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup-tickets') {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('main_ticket_menu')
            .setPlaceholder('اختر قسم التذكرة المناسب...')
            .addOptions([
                {
                    label: 'التواصل مع الإدارة',
                    description: 'فتح تذكرة للتحدث مع الإدارة',
                    value: 'ticket_management',
                    emoji: '🎫'
                },
                {
                    label: 'الشكاوي',
                    description: 'تقديم شكوى رسمية',
                    value: 'ticket_complaint',
                    emoji: '⚠️'
                },
                {
                    label: 'طلب رول',
                    description: 'طلب رتبة أو صلاحية',
                    value: 'ticket_role',
                    emoji: '⭐'
                },
                {
                    label: 'أخرى',
                    description: 'أسباب أخرى للتواصل',
                    value: 'ticket_other',
                    emoji: '📌'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // تم إضافة الصورة هنا أيضاً للوحة الرئيسية للـ !setup-tickets
        const embed = new EmbedBuilder()
            .setColor(0x2f3136)
            .setTitle('🎫 نظام الدعم والتذاكر')
            .setDescription('يرجى اختيار القسم المناسب من القائمة المنسدلة أدناه لفتح تذكرة جديدة وسيتم خدمتكم في أقرب وقت.')
            .setImage('https://media.discordapp.net/attachments/1531612317307899965/1531624502474051724/0303E296-7BB4-4B67-9FB9-F87851521A41.webp?ex=6a69e3f9&is=6a689279&hm=de37f69cc06c0f22008881950f5816ceb8fa8fc32abd66b7b71be91c9825319b&=&format=webp&width=1248&height=685');

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;

    if (interaction.isStringSelectMenu() && interaction.customId === 'main_ticket_menu') {
        await interaction.deferReply({ ephemeral: true });

        const selectedValue = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;

        let ticketName = 'تذكرة';
        let categoryId = process.env.TICKET_CATEGORY_ID;
        let targetRoleIds = [guild.id];

        switch (selectedValue) {
            case 'ticket_management': {
                ticketName = 'التواصل-مع-الإدارة';
                const envVal = process.env.SUPPORT_ROLE_MANAGEMENT;
                targetRoleIds = envVal ? envVal.split(',').map(id => id.trim()).filter(Boolean) : [guild.id];
                break;
            }
            case 'ticket_complaint': {
                ticketName = 'شكوى';
                const envVal = process.env.SUPPORT_ROLE_COMPLAINT;
                targetRoleIds = envVal ? envVal.split(',').map(id => id.trim()).filter(Boolean) : [guild.id];
                break;
            }
            case 'ticket_role': {
                ticketName = 'طلب-رول';
                const envVal = process.env.SUPPORT_ROLE_ROLE;
                targetRoleIds = envVal ? envVal.split(',').map(id => id.trim()).filter(Boolean) : [guild.id];
                break;
            }
            case 'ticket_other': {
                ticketName = 'أخرى';
                const envVal = process.env.SUPPORT_ROLE_OTHER;
                targetRoleIds = envVal ? envVal.split(',').map(id => id.trim()).filter(Boolean) : [guild.id];
                break;
            }
        }

        try {
            const permissionOverwrites = [
                {
                    id: guild.id,
                    denied: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: member.id,
                    allowed: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }
            ];

            targetRoleIds.forEach(roleId => {
                permissionOverwrites.push({
                    id: roleId,
                    allowed: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                });
            });

            const ticketChannel = await guild.channels.create({
                name: `${ticketName}-${member.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId || null,
                permissionOverwrites: permissionOverwrites
            });

            activeTickets.set(ticketChannel.id, { ownerId: member.id, claimedBy: null });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_close').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                new ButtonBuilder().setCustomId('btn_claim').setLabel('استلام').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
                new ButtonBuilder().setCustomId('btn_call').setLabel('استدعاء').setStyle(ButtonStyle.Primary).setEmoji('➡️'),
                new ButtonBuilder().setCustomId('btn_admin').setLabel('طلب إداري آخر').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
            );

            const embed = new EmbedBuilder()
                .setColor(0x2f3136)
                .setDescription(`نوع التذكرة: **${ticketName}**\n\nأهلاً بك <@${member.id}>، تم فتح التذكرة بنجاح. يرجى كتابة تفاصيل طلبك بانتظار رد المختصين.`)
                .setImage('https://media.discordapp.net/attachments/1531612317307899965/1531624502474051724/0303E296-7BB4-4B67-9FB9-F87851521A41.webp?ex=6a69e3f9&is=6a689279&hm=de37f69cc06c0f22008881950f5816ceb8fa8fc32abd66b7b71be91c9825319b&=&format=webp&width=1248&height=685');

            const mentions = targetRoleIds.map(id => `<@&${id}>`).join(' ') + ` , <@${member.id}>`;

            await ticketChannel.send({
                content: mentions,
                embeds: [embed],
                components: [row]
            });

            await interaction.editReply({ content: `✅ تم إنشاء تذكرتك بنجاح: <#${ticketChannel.id}>` });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التذكرة، تأكد من صلاحيات البوت وآيديات الرتب في ملف البيئة (.env).' });
        }
    }

    if (interaction.isButton()) {
        const channel = interaction.channel;
        const ticketData = activeTickets.get(channel.id);

        if (!ticketData) return;

        if (interaction.customId === 'btn_close') {
            await interaction.reply({ content: '🔒 جاري إغلاق وحذف التذكرة خلال 5 ثوانٍ...' });
            activeTickets.delete(channel.id);
            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 5000);
        }
        else if (interaction.customId === 'btn_claim') {
            if (ticketData.claimedBy) {
                return interaction.reply({ content: `❌ هذه التذكرة مستلمة بالفعل بواسطة <@${ticketData.claimedBy}>`, ephemeral: true });
            }
            ticketData.claimedBy = interaction.user.id;
            await interaction.reply({ content: `👤 تم استلام التذكرة بواسطة الإداري: <@${interaction.user.id}>` });
        }
        else if (interaction.customId === 'btn_call') {
            await interaction.reply({ content: `📢 تم إرسال تنبيه واستدعاء بواسطة <@${interaction.user.id}>.` });
        }
        else if (interaction.customId === 'btn_admin') {
            await interaction.reply({ content: `🔄 تم طلب انضمام إداري آخر للمساعدة بواسطة <@${interaction.user.id}>.` });
        }
    }
});

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Ticket Bot is running successfully!');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${port}`);
});

client.login(process.env.TOKEN);
