import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export const RC_SERVER_URL = 'Site_Url';

export const CONFIG_APP_SECRET = 'config_app_secret';
export const CONFIG_REQUEST_TIMEOUT = 'config_request_timeout';
export const CONFIG_FLOWS_ORG_TOKEN = 'config_flows_org_token';
export const CONFIG_ROOM_FIELD_NAME = 'config_room_field_name';
export const CONFIG_CLOSE_ROOM_FLOW = 'config_close_room_flow';
export const CONFIG_TRANSFER_ROOM_FLOW = 'config_transfer_room_flow';

export const APP_SETTINGS: Array<ISetting> = [
    {
        id: CONFIG_FLOWS_ORG_TOKEN,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_FLOWS_ORG_TOKEN,
    },
    {
        id: CONFIG_ROOM_FIELD_NAME,
        type: SettingType.STRING,
        packageValue: 'roomId',
        required: true,
        public: false,
        i18nLabel: CONFIG_ROOM_FIELD_NAME,
    },
    {
        id: CONFIG_APP_SECRET,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_APP_SECRET,
    },
    {
        id: CONFIG_REQUEST_TIMEOUT,
        type: SettingType.NUMBER,
        packageValue: 15,
        required: true,
        public: false,
        i18nLabel: CONFIG_REQUEST_TIMEOUT,
    },
    {
        id: CONFIG_CLOSE_ROOM_FLOW,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_CLOSE_ROOM_FLOW,
    },
    {
        id: CONFIG_TRANSFER_ROOM_FLOW,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_TRANSFER_ROOM_FLOW,
    },
];
