import { IHttp, ILogger, IModify, IPersistence, IPersistenceRead, IRead } from '@rocket.chat/apps-engine/definition/accessors';

import IAppDataSource from '../../data/app/IAppDataSource';
import IChatInternalDataSource from '../../data/chat/IChatInternalDataSource';
import IChatWebhook from '../../data/chat/IChatWebhook';
import AppPersistence from '../../local/app/AppPersistence';
import ChatAppsEngine from '../../local/chat/ChatAppsEngine';
import ChatWebhook from '../../remote/chat/ChatWebhook';

export default class InstanceHelper {

    public static async newDefaultChatInternalDataSource(read: IRead, modify: IModify, http: IHttp): Promise<IChatInternalDataSource> {
        return new ChatAppsEngine(read, modify, http);
    }

    public static async newDefaultChatWebhook(http: IHttp, read: IRead, secret: string, flowsOrgToken: string, roomFieldName: string, logger: ILogger, debugEnabled: boolean): Promise<IChatWebhook> {
        const loweredRoomFieldName = roomFieldName.toLowerCase();
        return new ChatWebhook(read, http, secret, flowsOrgToken, loweredRoomFieldName, logger, debugEnabled);
    }

    public static async newDefaultAppPersistence(read: IPersistenceRead, persis: IPersistence): Promise<IAppDataSource> {
        return new AppPersistence(read, persis);
    }

}
