import {
    HttpStatusCode,
    IHttp,
    ILivechatMessageBuilder,
    IMessageBuilder,
    IModify,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom, RoomType } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

import IChatInternalDataSource from '../../data/chat/IChatInternalDataSource';
import AppError from '../../domain/AppError';
import IAttachment from '../../domain/Attachment';
import AttachmentUtils from '../../utils/AttachmentUtils';

export default class ChatAppsEngine implements IChatInternalDataSource {

    constructor(
        private readonly read: IRead,
        private readonly modify: IModify,
        private readonly http: IHttp,
    ) { }

    public async getUserByUsername(username: string): Promise<IUser | undefined> {
        return await this.read.getUserReader().getByUsername(username);
    }

    public async getVisitorByToken(token: string): Promise<IVisitor | undefined> {
        return await this.read.getLivechatReader().getLivechatVisitorByToken(token);
    }

    public async sendLivechatMessage(botAgent: IUser, visitor: IVisitor, text?: string, attachments?: Array<IAttachment>): Promise<string> {

        const rooms = await this.read.getLivechatReader().getLivechatRooms(visitor);
        if (!rooms) {
            throw new AppError(`Could not find livechat room for visitor: ${visitor.token}`, HttpStatusCode.NOT_FOUND);
        }

        // TODO: check if index 0 will work on all situations
        const livechatMessageBuilder = this.modify.getCreator().startLivechatMessage()
            .setRoom(rooms[0])
            .setSender(botAgent);

        text && livechatMessageBuilder.setText(text);
        attachments && await this.createAttachments(attachments, livechatMessageBuilder, text, rooms[0], { user: botAgent });

        return await this.modify.getCreator().finish(livechatMessageBuilder);
    }

    public async sendMessage(bot: IUser, user: IUser, text?: string, attachments?: Array<IAttachment>): Promise<string> {

        let room: IRoom | undefined = await this.read.getRoomReader().getDirectByUsernames([bot.username, user.username]);

        // if user have never spoken with the bot, the room is undefined, we need to create a new direct room
        if (!room) {
            const roomBuilder = await this.modify.getCreator().startRoom()
                .setCreator(bot)
                .setType(RoomType.DIRECT_MESSAGE)
                .setDisplayName('')
                .setMembersToBeAddedByUsernames([user.username]);

            const roomId = await this.modify.getCreator().finish(roomBuilder);
            room = await this.read.getRoomReader().getById(roomId);
        }

        const messageBuilder = this.modify.getCreator().startMessage()
            .setRoom(room!)
            .setSender(bot);
        text && messageBuilder.setText(text);
        attachments && (await this.createAttachments(attachments, messageBuilder, text, room!, { user: bot }));

        return await this.modify.getCreator().finish(messageBuilder);
    }

    private async createAttachments(
        attachments: Array<IAttachment>,
        messageBuilder: IMessageBuilder | ILivechatMessageBuilder,
        text: string | undefined,
        room: IRoom,
        sender: {
            visitorToken?: string,
            user?: IUser,
        },
    ): Promise<void> {
        const messageAttachments: Array<IMessageAttachment> = [];
        attachments.map(async (attachment) => {
            const upload = await AttachmentUtils.createRocketUpload(this.http, this.modify, attachment, room, sender);
            if (upload) {
                switch (attachment.type.split('/')[0]) {
                    case 'image':
                        messageAttachments.push({ imageUrl: upload.url });
                        break;
                    case 'audio':
                        messageAttachments.push({ audioUrl: upload.url });
                        break;
                    case 'video':
                        messageAttachments.push({ videoUrl: upload.url });
                        break;
                    default: // TODO: wait for appsEngine support the creation of documents attachments
                        if (text) {
                            messageBuilder.setText(`${text}\n${upload.url}`);
                        } else {
                            messageBuilder.setText(upload.url);
                        }
                }
            }
        });
        messageBuilder.setAttachments(messageAttachments);
    }

}
