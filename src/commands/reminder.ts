import {
  ApplicationCommandOptionType,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock,
  Colors,
  ComponentType,
  MessageFlags,
  parseEmoji,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  TextChannel,
  ThumbnailComponent,
  userMention,
} from "discord.js";
import { Command, CommandCategory } from "../classes/Command";
import {
  createReminder,
  deleteReminder,
  getAllDmUsers,
  getAllGuildReminders,
  getAllUserReminders,
  getDbReminder,
  nextReminderTimestamp,
  setReminderMessageId,
  subscribeUser,
  unSubscribeUser,
} from "../utils/reminderUtils";
import { truncate } from "./movie";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import config from "../config";
import {
  createCustomId,
  generateCustomId,
  parseCustomId,
} from "../utils/customIdUtils";
import { reminders } from "../db/schema";
import { appEmoji } from "../utils/emojiUtils";
import { client } from "..";

const weekdays = [
  { name: "Sunday", value: "0" },
  { name: "Monday", value: "1" },
  { name: "Tuesday", value: "2" },
  { name: "Wednesday", value: "3" },
  { name: "Thursday", value: "4" },
  { name: "Friday", value: "5" },
  { name: "Saturday", value: "6" },
];

async function buildReminderContainer(
  interaction: ChatInputCommandInteraction,
  reminder: typeof reminders.$inferInsert,
): Promise<TMComponentBuilder> {
  let timeFormatter = Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
  });
  let container = new TMComponentBuilder().setAccentColor(config.brand_color);
  container.addTextDisplay(
    `## Reminder\n-# ID \`${reminder.id}\` | Created by ${userMention(interaction.user.id)}`,
  );
  container.addSeparator();
  container.addTextDisplay(
    `${codeBlock(reminder.content)}\n-# Sent every ${reminder.interval_weekday ? `${weekdays.find((w) => w.value === `${reminder.interval_weekday}`).name} at <t:${reminder.next_send_timestamp}:t>` : `${reminder.interval_months ? `${reminder.interval_months} Month${reminder.interval_months === 1 ? " " : "s "}` : ""}${reminder.interval_days ? `${reminder.interval_days} Day${reminder.interval_days === 1 ? " " : "s "}` : ""}${reminder.interval_hours ? `${reminder.interval_hours} Hour${reminder.interval_hours === 1 ? " " : "s "}` : ""}${reminder.interval_minutes ? `${reminder.interval_minutes} Minute${reminder.interval_minutes === 1 ? " " : "s"}` : ""}`}`,
  );

  container.addSeparator();
  container.addButtonActionRow([
    TMComponentBuilder.accessoryButton(
      ButtonStyle.Success,
      "Subscribe to DM Updates",
      null,
      { id: (await appEmoji(client, "reminder_subscribe")).id },
      parseCustomId(
        createCustomId({
          interactionId: interaction.id,
          action: `reminder-subscribe`,
          command: reminder.id,
        }),
      ),
    ),
    TMComponentBuilder.accessoryButton(
      ButtonStyle.Danger,
      "Unsubscribe",
      null,
      { id: (await appEmoji(client, "reminder_unsubscribe")).id },
      parseCustomId(
        createCustomId({
          interactionId: interaction.id,
          action: `reminder-unsubscribe`,
          command: reminder.id,
        }),
      ),
    ),
  ]);
  container.addSeparator(SeparatorSpacingSize.Small, false);
  container.addButtonActionRow([
    TMComponentBuilder.accessoryButton(
      ButtonStyle.Danger,
      "Delete Reminder",
      null,
      null,
      parseCustomId(
        createCustomId({
          interactionId: interaction.id,
          action: `reminder-delete`,
          command: reminder.id,
        }),
      ),
    ),
  ]);

  return container;
}

const ReminderCommand: Command = {
  enabled: true,
  name: "reminder",
  description: "Manage Reminders",
  category: CommandCategory.MOD,
  defaultMemberPermissions: [PermissionFlagsBits.ModerateMembers],
  options: [
    {
      name: "create",
      description: "Create a new reminder",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "text",
          description: "The content of the reminder",
          required: true,
          type: ApplicationCommandOptionType.String,
          maxLength: 200,
        },
        {
          name: "start-timestamp",
          description: "The time at which the reminder will begin",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 100000,
        },
        {
          name: "interval_weekday",
          description: "Send a reminder every weekday",
          required: false,
          type: ApplicationCommandOptionType.String,
          choices: weekdays,
        },
        {
          name: "interval_months",
          description: "Send a reminder every X month(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 12,
        },
        {
          name: "interval_days",
          description: "Send a reminder every X day(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 28,
        },
        {
          name: "interval_hours",
          description: "Send a reminder every X hour(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 23,
        },
        {
          name: "interval_minutes",
          description: "Send a reminder every X minute(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 59,
        },
      ],
    },
    /*{
      name: "edit",
      description: "Edit an existing reminder",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "reminder",
          description: "The reminder you'd like to edit",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "new-text",
          description: "The new content of the reminder",
          required: false,
          type: ApplicationCommandOptionType.String,
          maxLength: 200,
        },
        {
          name: "interval_weekday",
          description: "Update the reminder to send every weekday",
          required: false,
          type: ApplicationCommandOptionType.String,
          choices: weekdays,
        },
        {
          name: "interval_months",
          description: "Update the reminder to send every X month(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 12,
        },
        {
          name: "interval_days",
          description: "Update the reminder to send every X day(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 28,
        },
        {
          name: "interval_hours",
          description: "Update the reminder to send every X hour(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 23,
        },
        {
          name: "interval_minutes",
          description: "Update the reminder to send every X minute(s)",
          required: false,
          type: ApplicationCommandOptionType.Integer,
          minValue: 1,
          maxValue: 59,
        },
      ],
      }*/
    {
      name: "delete",
      description: "Delete an existing reminder",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "reminder",
          description: "The reminder you'd like to delete",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "subscribe-dm-updates",
      description: "Subscribe to DM updates for the specified reminder",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "reminder",
          description: "The reminder you'd like to subscribe to",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "unsubscribe-dm-updates",
      description: "Unsubscribe from DM updates for the specified reminder",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "reminder",
          description: "The reminder you'd like to subscribe to",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],
  autocomplete: async (interaction) => {
    let subcommand = interaction.options.getSubcommand(true);
    let focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "reminder") {
      let reminders = getAllGuildReminders(interaction.guildId);
      let query = focusedOption.value.trim();
      let max = 10;

      switch (subcommand) {
        case "delete":
        case "subscribe-dm-updates": {
          if (query === "") {
            await interaction.respond(
              reminders
                .map((r) => ({ name: truncate(r.content, 100), value: r.id }))
                .slice(0, max),
            );
            return;
          } else {
            reminders = reminders.filter((r) =>
              r.content.toLowerCase().includes(query.toLowerCase()),
            );
            await interaction.respond(
              reminders
                .map((r) => ({ name: truncate(r.content, 100), value: r.id }))
                .slice(0, max),
            );
          }

          break;
        }

        case "unsubscribe-dm-updates": {
          reminders = getAllUserReminders(interaction.user.id);
          if (query === "") {
            await interaction.respond(
              reminders
                .map((r) => ({ name: truncate(r.content, 100), value: r.id }))
                .slice(0, max),
            );
            return;
          } else {
            reminders = reminders.filter((r) =>
              r.content.toLowerCase().includes(query.toLowerCase()),
            );
            await interaction.respond(
              reminders
                .map((r) => ({ name: truncate(r.content, 100), value: r.id }))
                .slice(0, max),
            );
          }
          break;
        }
      }
    }
  },
  run: async (interaction) => {
    let subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case "create": {
        const confirmResponse = await interaction.deferReply({
          flags: [MessageFlags.Ephemeral],
          withResponse: true,
        });
        //create reminder
        let text = interaction.options.getString("text", true);

        let start_timestamp =
          Number(interaction.options.getInteger("start-timestamp", false)) || 0;
        let interval_weekday =
          Number(interaction.options.getString("interval_weekday", false)) || 0;
        let interval_months =
          interaction.options.getInteger("interval_months", false) || 0;
        let interval_days =
          interaction.options.getInteger("interval_days", false) || 0;
        let interval_hours =
          interaction.options.getInteger("interval_hours", false) || 0;
        let interval_minutes =
          interaction.options.getInteger("interval_minutes", false) || 0;

        let reminderData = {
          interval_days,
          interval_hours,
          interval_minutes,
          interval_months,
          interval_weekday,
          content: text,
          guild_id: interaction.guildId,
        };

        let potentialNextTimestamp = start_timestamp
          ? start_timestamp * 1000
          : nextReminderTimestamp(reminderData);
        let potentialNextTimestampReadable = Math.floor(
          potentialNextTimestamp / 1000,
        );

        if (
          potentialNextTimestamp <= Date.now() ||
          (!interval_days &&
            !interval_hours &&
            !interval_days &&
            !interval_months &&
            !interval_weekday &&
            !interval_minutes)
        )
          return interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "First reminder must be in the future",
              ).buildContainer(),
            ],
          });

        let expirationMs = 60e3;
        let expiresAt = Math.floor((Date.now() + expirationMs) / 1000);

        const confirmCont = new TMComponentBuilder().setAccentColor(
          Colors.Yellow,
        );

        confirmCont.addTextDisplay(
          `## Confirm Reminder Creation\nWould you like to create a new reminder?\n### Content\n${codeBlock(text)}\n-# The first reminder would be sent <t:${potentialNextTimestampReadable}:F> (<t:${potentialNextTimestampReadable}:R>)`,
        );
        confirmCont.addSeparator();
        confirmCont.addButtonActionRow([
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Success,
            "Create Reminder",
            null,
            null,
            parseCustomId(
              generateCustomId(interaction, "confirm-reminder-create"),
            ),
          ),
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Danger,
            "Cancel",
            null,
            null,
            parseCustomId(
              generateCustomId(interaction, "cancel-reminder-create"),
            ),
          ),
        ]);
        confirmCont.addSeparator();
        confirmCont.addTextDisplay(`-# Interaction Expires <t:${expiresAt}:R>`);

        await interaction.editReply({
          flags: [MessageFlags.IsComponentsV2],
          components: [confirmCont.buildContainer()],
        });

        let confirmInt: ButtonInteraction | null;
        confirmInt = await confirmResponse.resource.message
          .awaitMessageComponent({
            componentType: ComponentType.Button,
            time: expirationMs,
            filter: (i) => i.user.id === interaction.user.id,
          })
          .catch(() => (confirmInt = null));

        if (!confirmInt) {
          return interaction.editReply({
            components: [TMComponentBuilder.errorContainer().buildContainer()],
          });
        } else {
          if (confirmInt.customId.includes("cancel-reminder"))
            return interaction.editReply({
              components: [
                TMComponentBuilder.errorContainer(true).buildContainer(),
              ],
            });

          // create reminder :)
          try {
            let newReminder = createReminder(reminderData);
            nextReminderTimestamp(
              newReminder,
              start_timestamp ? start_timestamp * 1000 : 0,
            );
            let reminderChannel = interaction.guild.channels.cache.get(
              config.channels.reminders,
            ) as TextChannel;

            let reminderCont = await buildReminderContainer(
              interaction,
              newReminder,
            );

            confirmInt.deferUpdate();

            reminderChannel
              .send({
                flags: [MessageFlags.IsComponentsV2],
                components: [reminderCont.buildContainer()],
              })
              .then((m) => setReminderMessageId(newReminder.id, m.id));

            interaction.editReply({
              components: [
                new TMComponentBuilder()
                  .setAccentColor(Colors.Green)
                  .addTextDisplay("Creating Reminder...")
                  .buildContainer(),
              ],
            });

            await subscribeUser(interaction.user.id, newReminder.id);
          } catch (e) {
            console.log(e);
            await interaction.editReply({
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  `Failed to create reminder\n\n${codeBlock(e)}`,
                ).buildContainer(),
              ],
            });
          }
        }

        break;
      }
      case "delete": {
        const confirmResponse = await interaction.deferReply({
          flags: [MessageFlags.Ephemeral],
          withResponse: true,
        });
        let reminderId = interaction.options.getString("reminder", true);
        let dbReminder = getDbReminder(reminderId);

        if (!dbReminder)
          return interaction.editReply({
            flags: [, MessageFlags.IsComponentsV2],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                `Reminder with ID ${reminderId} not found.`,
              ).buildContainer(),
            ],
          });

        let expirationMs = 60e3;
        let expiresAt = Math.floor((Date.now() + expirationMs) / 1000);

        const confirmCont = new TMComponentBuilder().setAccentColor(
          Colors.Yellow,
        );
        confirmCont.addTextDisplay(
          `## Confirm Reminder Deletion\nAre you sure you want to delete reminder with ID \`${dbReminder.id}\`?\n### Reminder Content\n${codeBlock(dbReminder.content)}\n\n-# Choose "Confirm" to continue | Interaction Expires <t:${expiresAt}:R>`,
        );
        confirmCont.addSeparator(SeparatorSpacingSize.Small, false);
        confirmCont.addButtonActionRow([
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Success,
            "Confirm",
            null,
            null,
            parseCustomId(generateCustomId(interaction, "confirm-delete")),
          ),
          TMComponentBuilder.accessoryButton(
            ButtonStyle.Danger,
            "Cancel",
            null,
            null,
            parseCustomId(generateCustomId(interaction, "cancel-delete")),
          ),
        ]);

        await interaction.editReply({
          flags: [MessageFlags.IsComponentsV2],
          components: [confirmCont.buildContainer()],
        });

        let confirmInt: ButtonInteraction | null;
        confirmInt = await confirmResponse.resource.message
          .awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: expirationMs,
          })
          .catch(() => (confirmInt = null));

        if (!confirmInt) {
          return interaction.editReply({
            components: [TMComponentBuilder.errorContainer().buildContainer()],
          });
        } else {
          if (confirmInt.customId.includes("cancel-delete"))
            return interaction.editReply({
              components: [
                TMComponentBuilder.errorContainer(true).buildContainer(),
              ],
            });

          let reminderChannel = interaction.guild.channels.cache.get(
            config.channels.reminders,
          ) as TextChannel;
          let reminderMessage =
            (await reminderChannel.messages.fetch(dbReminder.message_id)) ||
            null;

          try {
            if (reminderMessage && reminderMessage.deletable)
              await reminderMessage.delete();
            deleteReminder(dbReminder.id);
            client.emit("reminderDeleted", dbReminder, interaction.user);

            interaction.editReply({
              components: [
                new TMComponentBuilder()
                  .setAccentColor(Colors.Green)
                  .addTextDisplay(
                    `Successfully deleted reminder \`${dbReminder.id}\``,
                  )
                  .buildContainer(),
              ],
            });
          } catch (e) {
            interaction.editReply({
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  `Failed to delete reminder \`${dbReminder.id}\`\n${codeBlock(e)}`,
                ).buildContainer(),
              ],
            });
          }
        }

        break;
      }
      case "subscribe-dm-updates": {
        let reminderId = interaction.options.getString("reminder", true);
        let dbReminder = getDbReminder(reminderId);

        if (!dbReminder)
          return await interaction.reply({
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "Failed to find the specified reminder.",
              ).buildContainer(),
            ],
          });
        let dmUsers = getAllDmUsers(dbReminder.id);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        try {
          if (
            dmUsers.some(
              (u) =>
                u.reminder_id === dbReminder.id &&
                u.user_id === interaction.user.id,
            )
          )
            return await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  "You are already subscribed to this reminder.",
                ).buildContainer(),
              ],
            });

          await subscribeUser(interaction.user.id, dbReminder.id);
          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
              new TMComponentBuilder()
                .setAccentColor(Colors.Green)
                .addTextDisplay(`Subscribed to reminder \`${dbReminder.id}\``)
                .buildContainer(),
            ],
          });
        } catch (e) {
          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "Failed to subscribe to reminder.",
              ).buildContainer(),
            ],
          });
        }
        break;
      }

      case "unsubscribe-dm-updates": {
        let reminderId = interaction.options.getString("reminder", true);
        let dbReminder = getDbReminder(reminderId);

        if (!dbReminder)
          return await interaction.reply({
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "Failed to find the specified reminder.",
              ).buildContainer(),
            ],
          });
        let dmUsers = getAllDmUsers(dbReminder.id);

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
          if (
            !dmUsers.some(
              (u) =>
                u.reminder_id === dbReminder.id &&
                u.user_id === interaction.user.id,
            )
          )
            return await interaction.editReply({
              flags: [MessageFlags.IsComponentsV2],
              components: [
                TMComponentBuilder.errorContainer(
                  true,
                  "You are not subscribed to this reminder.",
                ).buildContainer(),
              ],
            });

          await unSubscribeUser(interaction.user.id, dbReminder.id);
          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
              new TMComponentBuilder()
                .setAccentColor(Colors.Green)
                .addTextDisplay(
                  `Unsubscribed from reminder \`${dbReminder.id}\``,
                )
                .buildContainer(),
            ],
          });
        } catch (e) {
          await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
              TMComponentBuilder.errorContainer(
                true,
                "Failed to unsubscribe from reminder.",
              ).buildContainer(),
            ],
          });
        }
        break;
      }
    }
  },
};

export default ReminderCommand;
