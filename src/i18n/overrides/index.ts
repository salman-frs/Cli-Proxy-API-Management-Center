import type { i18n as I18n } from 'i18next';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';
import en from './en.json';
import ru from './ru.json';
import vi from './vi.json';
import ko from './ko.json';
import tr from './tr.json';

const overrides = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ru,
  vi,
  ko,
  tr,
};

export function applyStringOverrides(instance: I18n) {
  for (const [language, strings] of Object.entries(overrides)) {
    instance.addResourceBundle(language, 'translation', strings, true, true);
  }
}
