import { Canvas, createCanvas, CanvasRenderingContext2D, Image } from "canvas";
import { AttachmentBuilder, GuildMember, MessageFlags } from "discord.js";
import { TMComponentBuilder } from "../classes/ComponentBuilder";
import { avg } from "..";

function roundedImage(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function ordinal_suffix_of(i) {
    let j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return i + "st";
    }
    if (j === 2 && k !== 12) {
        return i + "nd";
    }
    if (j === 3 && k !== 13) {
        return i + "rd";
    }
    return i + "th";
}

export function memberWelcomeImage(m: GuildMember): Promise<{ attachment: AttachmentBuilder, url: string } | null> {
    return new Promise((resolve) => {
        const canvas: Canvas = createCanvas(2100, 850);
        const ctx: CanvasRenderingContext2D = canvas.getContext("2d");

        avg(m.displayAvatarURL(), true).then((memberAvgColor: string) => {

            
            let strokeColor = "#142E35"
            
            let borderRadius = 32;
            let w = canvas.width;
            let h = canvas.height;
            
            ctx.save();
            roundedImage(ctx, 0, 0, w, h, borderRadius);
            ctx.stroke();
            ctx.clip();
            
            let gradient = ctx.createLinearGradient(w, h, w, h);
            // gradient.addColorStop(0, `${memberAvgColor}9b`);
            gradient.addColorStop(2, `#286E819b`);
            gradient.addColorStop(10, "#19434F9b")
            
            ctx.fillStyle = "#2F2F2F";
            ctx.fillRect(0, 0, w, h);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            
            ctx.restore();
            
            let i = 512;
            let padding = 100;
            let strokeWidth = 10;
            let verticalOffset = (h / 2) - ((i + strokeWidth) / 2);
            let verticalOffsetFrombottom = verticalOffset + (i + (strokeWidth / 2));
            let textHorizonalOffset = (padding + i + (strokeWidth / 2)) + 50;
            
            ctx.save();
            roundedImage(ctx, padding - (strokeWidth / 2), verticalOffset, i + strokeWidth, i + strokeWidth, borderRadius)
            ctx.stroke();
            ctx.clip();
            ctx.fillStyle = strokeColor;
            ctx.fillRect(padding - (strokeWidth / 2), (h / 2) - ((i + strokeWidth) / 2), i + strokeWidth, i + strokeWidth)
            ctx.restore();
            
            let image = new Image();
            
            image.onload = () => {
                console.log("Image loaded", image)
                ctx.save();
                roundedImage(ctx, padding, (h / 2) - (i / 2), i, i, borderRadius)
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(image, padding, (h / 2) - (i / 2), i, i)
                ctx.restore();
                
                let lineHeight = 90;
                
                ctx.font = "900 90px Open Sans";
                ctx.fillStyle = "#ffffffcc";
                
                ctx.fillText("Welcome to coduh's crib!", textHorizonalOffset, verticalOffset + lineHeight, 1300);
                
                ctx.font = "600 70px Open Sans";
                ctx.fillStyle = "#78e1fdd7";
                
                ctx.fillText(`@${m.user.username}`, textHorizonalOffset, verticalOffset + (lineHeight * 3), 1300);
                
                ctx.font = "900 90px Open Sans";
                ctx.fillStyle = "#ffffffcc";
                ctx.fillText(`You're the ${ordinal_suffix_of(m.guild.memberCount)} member!`, textHorizonalOffset, verticalOffsetFrombottom - 20, 1300);
                
                
                let exported = canvas.toBuffer("image/png");
                let attachmentName = `welcome-${m.id}.png`;
                const at = new AttachmentBuilder(exported, { name: attachmentName });
                let attachmentUrl = `attachment://${attachmentName}`;
                
                resolve({ attachment: at, url: attachmentUrl });
            }
            
            image.onerror = (err) => {
                resolve(null);
            }
            
            image.src = m.displayAvatarURL({ forceStatic: true, extension: "png", size: 512 });
        });
    });
    }