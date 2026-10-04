import { ActionRowData, AnyComponent, APIMessageTopLevelComponent, Component, JSONEncodable, MessageActionRowComponentBuilder, MessageActionRowComponentData, SectionBuilder, TopLevelComponentData } from "discord.js";
import { sticky_messages } from "../db/schema";
import { TMComponentBuilder } from "../classes/ComponentBuilder";

export const buildStickyMessage = (message: typeof sticky_messages.$inferInsert): (APIMessageTopLevelComponent | JSONEncodable<APIMessageTopLevelComponent> | TopLevelComponentData | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>)[] => {
  let components: (APIMessageTopLevelComponent | JSONEncodable<APIMessageTopLevelComponent> | TopLevelComponentData | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>)[] = [];

  if (message.content.includes("\n---")) {
    let split = message.content.split("\n---");
    for (let i = 0; i < split.length; i++) {
      let s = split[i];
      if (i !== 0) components.push(TMComponentBuilder.separator());
      components.push(TMComponentBuilder.textDisplay(s.trim()));
    }
  } else components.push(TMComponentBuilder.textDisplay(message.content));

  components = [
    ...components,
    TMComponentBuilder.separator(),
    TMComponentBuilder.textDisplay(`-# 📌 This is a sticky message that is deleted and reposted to remain at the bottom of the channel`)
  ];

  return components;
};
