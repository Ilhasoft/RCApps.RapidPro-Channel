import {ISetting, SettingType} from '@rocket.chat/apps-engine/definition/settings';

export const RC_SERVER_URL = 'Site_Url';

export const CONFIG_APP_SECRET = 'config_app_secret';
export const CONFIG_RAPIDPRO_AUTH_TOKEN = 'config_rapidpro_auth_token';
export const CONFIG_REQUEST_TIMEOUT = 'config_request_timeout';
export const CONFIG_RC_X_AUTH_TOKEN = 'config_rocketchat_x_auth_token';
export const CONFIG_RC_X_USER_ID = 'config_rocketchat_x_user_id';

export const APP_SETTINGS: Array<ISetting> = [
    {
        id: CONFIG_APP_SECRET,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_APP_SECRET,
    },
    {
        id: CONFIG_RAPIDPRO_AUTH_TOKEN,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_RAPIDPRO_AUTH_TOKEN,
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
        id: CONFIG_RC_X_AUTH_TOKEN,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_RC_X_AUTH_TOKEN,
    },
    {
        id: CONFIG_RC_X_USER_ID,
        type: SettingType.STRING,
        packageValue: '',
        required: true,
        public: false,
        i18nLabel: CONFIG_RC_X_USER_ID,
    },
];
