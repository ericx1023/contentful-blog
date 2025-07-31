const path = require('path');

module.exports = {
  i18n: {
    defaultLocale: 'zh-Hant-TW',
    locales: ['zh-Hant-TW', 'en-US'],
    localeDetection: false,
  },
  localePath: path.resolve('./public/locales'),
};
