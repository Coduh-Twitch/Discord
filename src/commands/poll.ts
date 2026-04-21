import { ApplicationCommandOptionType, channelMention, ChannelType, ChatInputCommandInteraction, CheckboxBuilder, CheckboxGroupBuilder, CheckboxGroupOptionBuilder, ComponentType, GuildChannel, LabelBuilder, MessageFlags, ModalAssertions, ModalBuilder, ModalSubmitInteraction, PermissionFlagsBits, PollData, PollLayoutType, RadioGroupBuilder, RadioGroupOptionBuilder, TextChannel, TextInputBuilder, TextInputModalData, TextInputStyle, ThreadAutoArchiveDuration, userMention } from "discord.js";
import { Command } from "../classes/Command";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

const PollCommand: Command = {
    enabled: true,
    name: "poll",
    description: "Manage Discord polls",
    defaultMemberPermissions: [PermissionFlagsBits.SendPolls],
    options: [
        {
            name: "create",
            description: "Create a poll",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "channel",
                    description: "The channel to send the poll in. Defaults to the channel you're currently in.",
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildStageVoice, ChannelType.GuildVoice],
                    required: false
                }
            ]
        }
    ],
    run: async (interaction: ChatInputCommandInteraction) => {
        let subcommand = interaction.options.getSubcommand(true);

        if(subcommand === "create") {
            // await interaction.deferReply({flags: [MessageFlags.Ephemeral]});
            let channel: TextChannel = ((interaction.options.getChannel("channel", false)) && (interaction.options.getChannel("channel", false) as GuildChannel).isSendable()) ? interaction.options.getChannel("channel", false) as TextChannel : interaction.channel as TextChannel;

            let expiryTime = 20e3;

            let pollModal = new ModalBuilder().setCustomId('poll-modal').setTitle("Poll Setup (1 hour poll)");
            
            let pollTitleInput = new TextInputBuilder().setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(300).setRequired(true).setPlaceholder("Poll title or Question...").setCustomId('poll-title')
            let pollTitleLabel = new LabelBuilder().setLabel(`Poll Title`).setDescription(`The name of your poll, or a question you're asking with the poll.`).setTextInputComponent(pollTitleInput);

            pollModal.addLabelComponents(pollTitleLabel);

            let allowMultiInputGroup = new RadioGroupBuilder().setRequired(true).setCustomId('multiselect');
            let allowMultiInput = new RadioGroupOptionBuilder().setLabel("Yes").setValue("allow");
            let denyMultiInput = new RadioGroupOptionBuilder().setLabel("No").setValue("denu");

            allowMultiInputGroup.addOptions([allowMultiInput, denyMultiInput])

            let allowMultiInputLabel = new LabelBuilder().setLabel("Allow Multiple Votes?");
            allowMultiInputLabel.setRadioGroupComponent(allowMultiInputGroup);

            pollModal.addLabelComponents(allowMultiInputLabel)

            let questions = [];

            let MAX_QUESTIONS = 3;
            for(var i = 0; i < MAX_QUESTIONS; i++) {
                let answerInput = new TextInputBuilder().setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(55).setRequired((i+1) < 3).setPlaceholder(`Answer #${i+1}`).setCustomId(`poll-answer-${i+1}`)
                let answerLabel = new LabelBuilder().setLabel(`Answer ${i+1}`).setDescription(`Enter answer #${i+1}`).setTextInputComponent(answerInput);
                questions.push(answerLabel);
            }

            if(questions.length === MAX_QUESTIONS) pollModal.addLabelComponents(...questions);



            let modalSubmit: ModalSubmitInteraction | null;
            let modal = await interaction.showModal(pollModal, {withResponse: true}).catch(e => modalSubmit = null);

            modalSubmit = await interaction.awaitModalSubmit({time: expiryTime}).catch(e => modalSubmit = null)
            
            
            if(!modalSubmit) {
                interaction.followUp({flags: [MessageFlags.Ephemeral], content: `The interaction expired or was cancelled`})
            } else {
                
                let fields = modalSubmit.fields;
                let question = fields.getField("poll-title", ComponentType.TextInput);
                let answer_1 = fields.getField("poll-answer-1", ComponentType.TextInput);
                let answer_2 = fields.getField("poll-answer-2", ComponentType.TextInput);
                let answer_3 = fields.getField("poll-answer-3", ComponentType.TextInput);
                let multiselect = fields.getRadioGroup("multiselect", true) === "allow";

                let answers: TextInputModalData[] = [];
                if(answer_1.value) answers.push(answer_1);
                if(answer_2.value) answers.push(answer_2);
                if(answer_3.value) answers.push(answer_3);

                let pollData: PollData = {
                    allowMultiselect: multiselect,
                    question: {
                        text: question.value,
                    },
                    duration: 1,
                    answers: answers.map(a => ({text: a.value})),
                    layoutType: PollLayoutType.Default
                }

                channel.send({poll: pollData, content: `### Poll by ${userMention(interaction.user.id)}\n-# Voting ends <t:${Math.floor((Date.now() + 36e5) / 1000)}:R>`}).then(m => {
                    modalSubmit.reply({flags: [MessageFlags.Ephemeral], content: `Sending poll to ${channelMention(channel.id)}!`})
                }).catch(e => {
                    console.log(e);
                    modalSubmit.reply({flags: [MessageFlags.Ephemeral], content: `Failed to send poll`})
                });

            }
        }
    }
}

export default PollCommand;